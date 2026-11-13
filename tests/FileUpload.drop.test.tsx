import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/lib/upload-file', () => ({ uploadFile: vi.fn() }))

import FileUpload from '@/components/ui/FileUpload'
import { uploadFile } from '@/lib/upload-file'

const mockUpload = vi.mocked(uploadFile)

function drop(target: Element, files: File[]) {
  const dataTransfer = { files, types: ['Files'], dropEffect: 'none' }
  fireEvent.dragEnter(target, { dataTransfer })
  fireEvent.dragOver(target, { dataTransfer })
  fireEvent.drop(target, { dataTransfer })
}

describe('FileUpload drag and drop', () => {
  beforeEach(() => {
    mockUpload.mockReset()
    mockUpload.mockImplementation(async (_file, _bucket, path) => ({ ok: true, url: `https://x/${path}`, path }))
  })

  it('uploads every dropped file in the dropzone', async () => {
    const onUpload = vi.fn()
    render(<FileUpload bucket="lms-submissions" path="a1/s1/" multiple dropzone onUpload={onUpload} />)
    const zone = screen.getByText('Drag files here, or').parentElement!
    drop(zone, [new File(['x'], 'shot one.png', { type: 'image/png' }), new File(['y'], 'notes.pdf', { type: 'application/pdf' })])
    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(2))
    expect(mockUpload).toHaveBeenCalledWith(expect.any(File), 'lms-submissions', 'a1/s1/shot_one.png')
    expect(mockUpload).toHaveBeenCalledWith(expect.any(File), 'lms-submissions', 'a1/s1/notes.pdf')
  })

  it('refuses a dropped file the input would not accept', async () => {
    const onUpload = vi.fn()
    const onError = vi.fn()
    render(<FileUpload bucket="lms-submissions" path="a1/s1/" multiple dropzone onUpload={onUpload} onError={onError} />)
    drop(screen.getByText('Drag files here, or').parentElement!, [new File(['x'], 'run.exe', { type: 'application/x-msdownload' })])
    await waitFor(() => expect(onError).toHaveBeenCalledWith('run.exe: file type not allowed'))
    expect(mockUpload).not.toHaveBeenCalled()
    expect(onUpload).not.toHaveBeenCalled()
  })

  it('takes only the first file when not multiple', async () => {
    const onUpload = vi.fn()
    const { container } = render(<FileUpload bucket="lms-resources" path="p/" onUpload={onUpload} />)
    drop(container.firstElementChild!, [new File(['x'], 'a.png', { type: 'image/png' }), new File(['y'], 'b.png', { type: 'image/png' })])
    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1))
  })
})
