"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Assignment = {
  id: string;
  title: string;
  due_date: string | null;
  description?: string | null;
  module_day_id: string;
};

type Resource = {
  id: string;
  module_day_id: string;
  type: "video" | "reading" | "link" | "file";
  title: string;
  content: string | null;
  order: number;
};

type Day = {
  id: string;
  day_name: string;
  order: number;
  module_id: string;
  assignments?: Assignment[];
  resources?: Resource[];
};

type Module = {
  id: string;
  title: string;
  week_number: number;
  order: number;
  course_id: string;
  module_days: Day[];
};

function AssignmentDropZone({ day, assignments }: { day: Day; assignments: Assignment[] }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-${day.id}`,
    data: { type: "day-drop", dayId: day.id },
  });

  return (
    <div className="bg-white/60 rounded-xl p-3">
      <p className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">
        Assignments
      </p>
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 min-h-[48px] rounded-lg p-1 transition-colors ${
          isOver ? "bg-teal-50 border border-dashed border-teal-300" : ""
        }`}
      >
        {assignments.length === 0 ? (
          <p className="text-xs text-gray-400 py-2 px-1">No assignments. Drag one here.</p>
        ) : (
          assignments
            .slice()
            .sort((a, b) => {
              if (!a.due_date && !b.due_date) return 0;
              if (!a.due_date) return 1;
              if (!b.due_date) return -1;
              return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
            })
            .map((a) => (
              <DraggableAssignment key={a.id} assignment={a} dayId={day.id} />
            ))
        )}
      </div>
    </div>
  );
}

function DraggableAssignment({ assignment, dayId }: { assignment: Assignment; dayId: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `assignment-${assignment.id}`,
    data: { type: "assignment", assignmentId: assignment.id, sourceDayId: dayId },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-lg border border-gray-100 px-3 py-2 flex items-center gap-2 ${isDragging ? "opacity-50 shadow-lg z-50" : ""}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="text-gray-300 hover:text-gray-500 cursor-grab shrink-0"
        type="button"
        aria-label="Drag assignment"
      >
        ⠿
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-dark-text truncate">{assignment.title}</p>
        <p className="text-xs text-gray-400">
          Due: {assignment.due_date ? new Date(assignment.due_date).toLocaleString() : "None"}
        </p>
      </div>
    </div>
  );
}

const RESOURCE_TYPE_LABELS: Record<Resource["type"], string> = {
  video: "Video",
  reading: "Reading",
  link: "Link",
  file: "File",
};

function SortableResource({
  resource,
  onEdit,
  onDelete,
}: {
  resource: Resource;
  onEdit: (id: string, updates: Partial<Pick<Resource, "type" | "title" | "content">>) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `resource-${resource.id}`,
    data: { type: "resource" },
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const [editing, setEditing] = useState(false);
  const [editType, setEditType] = useState<Resource["type"]>(resource.type);
  const [editTitle, setEditTitle] = useState(resource.title);
  const [editContent, setEditContent] = useState(resource.content ?? "");

  const handleSave = () => {
    if (!editTitle.trim()) return;
    onEdit(resource.id, {
      type: editType,
      title: editTitle.trim(),
      content: editContent.trim() || null,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="bg-white rounded-lg border border-teal-primary/30 p-3 flex flex-col gap-2"
      >
        <div className="flex gap-2">
          <select
            value={editType}
            onChange={(e) => setEditType(e.target.value as Resource["type"])}
            className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-primary"
          >
            <option value="link">Link</option>
            <option value="video">Video</option>
            <option value="reading">Reading</option>
            <option value="file">File</option>
          </select>
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Title"
            className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-primary"
          />
        </div>
        <input
          type="text"
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          placeholder="URL or content"
          className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-primary"
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setEditing(false)}
            className="text-xs text-gray-400 hover:text-gray-600"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="text-xs text-teal-primary font-medium hover:underline"
            type="button"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-lg border border-gray-100 px-3 py-2 flex items-center gap-2"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-gray-300 hover:text-gray-500 cursor-grab shrink-0"
        type="button"
        aria-label="Drag resource"
      >
        ⠿
      </button>
      <span className="text-xs bg-teal-light text-teal-primary rounded px-1.5 py-0.5 shrink-0">
        {RESOURCE_TYPE_LABELS[resource.type]}
      </span>
      <div className="flex-1 min-w-0 group">
        <button
          onClick={() => setEditing(true)}
          className="text-xs font-medium text-dark-text truncate hover:text-teal-primary transition-colors w-full text-left flex items-center gap-1"
          type="button"
        >
          {resource.title}
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-teal-primary shrink-0">✎</span>
        </button>
        {resource.content && (
          <a
            href={resource.content.startsWith("http") ? resource.content : `https://${resource.content}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-teal-primary truncate hover:underline block"
            onClick={(e) => e.stopPropagation()}
          >
            {resource.content}
          </a>
        )}
      </div>
      <button
        onClick={() => onDelete(resource.id)}
        className="text-gray-300 hover:text-red-400 text-xs shrink-0"
        type="button"
        aria-label="Delete resource"
      >
        ✕
      </button>
    </div>
  );
}

function SortableDay({
  day,
  onDelete,
}: {
  day: Day;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: `day-${day.id}`,
      data: { type: "day", moduleId: day.module_id },
    });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const [open, setOpen] = useState(false);
  const assignments = day.assignments ?? [];
  const supabase = createClient();

  const [resources, setResources] = useState<Resource[]>([]);
  const resourcesRef = useRef(resources);
  useEffect(() => {
    resourcesRef.current = resources;
  }, [resources]);

  useEffect(() => {
    supabase
      .from("resources")
      .select("*")
      .eq("module_day_id", day.id)
      .order("order")
      .then(({ data }) => {
        if (data) setResources(data);
      });
  }, [day.id]);

  const resourceSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleResourceDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const current = resourcesRef.current;
    const oldIndex = current.findIndex((r) => `resource-${r.id}` === active.id);
    const newIndex = current.findIndex((r) => `resource-${r.id}` === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove([...current], oldIndex, newIndex).map((r, i) => ({
      ...r,
      order: i,
    }));
    setResources(reordered);
    await Promise.all(
      reordered.map((r, i) =>
        supabase.from("resources").update({ order: i }).eq("id", r.id)
      )
    );
  };

  const addResource = async (type: Resource["type"], title: string, content: string) => {
    const { data, error } = await supabase
      .from("resources")
      .insert({
        module_day_id: day.id,
        type,
        title,
        content: content || null,
        order: resourcesRef.current.length,
      })
      .select()
      .single();
    if (error) {
      console.error("Failed to add resource:", error);
      return;
    }
    if (data) {
      setResources((prev) => [...prev, data]);
    }
  };

  const editResource = async (
    id: string,
    updates: Partial<Pick<Resource, "type" | "title" | "content">>
  ) => {
    await supabase.from("resources").update(updates).eq("id", id);
    setResources((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  };

  const deleteResource = async (id: string) => {
    await supabase.from("resources").delete().eq("id", id);
    setResources((prev) => prev.filter((r) => r.id !== id));
  };

  const [newResType, setNewResType] = useState<Resource["type"]>("link");
  const [newResTitle, setNewResTitle] = useState("");
  const [newResContent, setNewResContent] = useState("");

  const submitNewResource = () => {
    if (!newResTitle.trim()) return;
    addResource(newResType, newResTitle.trim(), newResContent.trim());
    setNewResTitle("");
    setNewResContent("");
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-background rounded-lg">
      <div className="flex items-center gap-3 px-4 py-2">
        <button
          {...attributes}
          {...listeners}
          className="text-gray-300 hover:text-gray-500 cursor-grab"
          aria-label={`Drag day ${day.day_name}`}
          type="button"
        >
          ⠿
        </button>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-sm text-dark-text flex-1 text-left flex items-center gap-2"
          aria-expanded={open}
          aria-controls={`day-panel-${day.id}`}
        >
          <span>{day.day_name}</span>
          <span className="text-xs text-gray-400">
            ({assignments.length + resources.length})
          </span>
        </button>

        <button
          onClick={() => onDelete(day.id)}
          className="text-gray-300 hover:text-red-400 text-xs"
          aria-label={`Delete day ${day.day_name}`}
          type="button"
        >
          ✕
        </button>
      </div>

      {open && (
        <div
          id={`day-panel-${day.id}`}
          className="px-10 pb-4 pt-2 border-t border-gray-100 flex flex-col gap-4"
        >
          {/* Resources */}
          <div>
            <p className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">
              Resources
            </p>
            <DndContext
              sensors={resourceSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleResourceDragEnd}
            >
              <SortableContext
                items={resources.map((r) => `resource-${r.id}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-1.5 mb-2">
                  {resources.map((r) => (
                    <SortableResource
                      key={r.id}
                      resource={r}
                      onEdit={editResource}
                      onDelete={deleteResource}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <select
                  value={newResType}
                  onChange={(e) => setNewResType(e.target.value as Resource["type"])}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-primary"
                >
                  <option value="link">Link</option>
                  <option value="video">Video</option>
                  <option value="reading">Reading</option>
                  <option value="file">File</option>
                </select>
                <input
                  type="text"
                  placeholder="Title"
                  value={newResTitle}
                  onChange={(e) => setNewResTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitNewResource(); }}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-primary"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="URL or content"
                  value={newResContent}
                  onChange={(e) => setNewResContent(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitNewResource(); }}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-primary"
                />
                <button
                  onClick={submitNewResource}
                  className="bg-teal-light text-teal-primary px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-teal-primary hover:text-white transition-colors"
                  type="button"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Assignments */}
          <AssignmentDropZone day={day} assignments={assignments} />
        </div>
      )}
    </div>
  );
}

function SortableModule({
  module,
  onDelete,
  onAddDay,
  onDeleteDay,
}: {
  module: Module;
  onDelete: (id: string) => void;
  onAddDay: (moduleId: string, dayName: string) => void;
  onDeleteDay: (dayId: string, moduleId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: `module-${module.id}`,
      data: { type: "module" },
    });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const [expanded, setExpanded] = useState(true);
  const [newDayName, setNewDayName] = useState("");

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-3 px-6 py-4">
        <button
          {...attributes}
          {...listeners}
          className="text-gray-300 hover:text-gray-500 cursor-grab text-lg"
          aria-label={`Drag module ${module.title}`}
          type="button"
        >
          ⠿
        </button>
        <div className="flex-1">
          <h3 className="font-semibold text-dark-text">{module.title}</h3>
          <p className="text-xs text-gray-400">Week {module.week_number}</p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 hover:text-teal-primary text-sm px-3"
          aria-label={expanded ? "Collapse module" : "Expand module"}
          type="button"
        >
          {expanded ? "▲" : "▼"}
        </button>
        <button
          onClick={() => onDelete(module.id)}
          className="text-gray-300 hover:text-red-400 text-sm"
          aria-label={`Delete module ${module.title}`}
          type="button"
        >
          ✕
        </button>
      </div>

      {expanded && (
        <div className="px-6 pb-4 flex flex-col gap-2 border-t border-gray-50 pt-4">
          <SortableContext
            items={[...module.module_days]
              .sort((a, b) => a.order - b.order)
              .map((d) => `day-${d.id}`)}
            strategy={verticalListSortingStrategy}
          >
            {[...module.module_days]
              .sort((a, b) => a.order - b.order)
              .map((day) => (
                <SortableDay
                  key={day.id}
                  day={day}
                  onDelete={(id) => onDeleteDay(id, module.id)}
                />
              ))}
          </SortableContext>

          <div className="flex gap-2 mt-2">
            <input
              type="text"
              placeholder="Add a day (e.g. Monday)"
              value={newDayName}
              onChange={(e) => setNewDayName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newDayName.trim()) {
                  onAddDay(module.id, newDayName.trim());
                  setNewDayName("");
                }
              }}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary"
              aria-label="New day name"
            />
            <button
              onClick={() => {
                if (newDayName.trim()) {
                  onAddDay(module.id, newDayName.trim());
                  setNewDayName("");
                }
              }}
              className="bg-teal-light text-teal-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-primary hover:text-white transition-colors"
              type="button"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CourseEditor({
  course,
  initialModules,
}: {
  course: any;
  initialModules: Module[];
}) {
  const [modules, setModules] = useState<Module[]>(initialModules);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newModuleWeek, setNewModuleWeek] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const modulesRef = useRef(modules);
  useEffect(() => {
    modulesRef.current = modules;
  }, [modules]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Handle cross-day assignment moves
    if (activeData?.type === "assignment") {
      let targetDayId: string | null = null;
      if (overData?.type === "day-drop") {
        targetDayId = overData.dayId;
      } else if (overData?.type === "day") {
        targetDayId = (over.id as string).replace("day-", "");
      }
      if (!targetDayId || targetDayId === activeData.sourceDayId) return;

      const { assignmentId, sourceDayId } = activeData;

      let assignmentToMove: Assignment | undefined;
      for (const m of modulesRef.current) {
        for (const d of m.module_days) {
          if (d.id === sourceDayId) {
            assignmentToMove = d.assignments?.find((a) => a.id === assignmentId);
            break;
          }
        }
        if (assignmentToMove) break;
      }
      if (!assignmentToMove) return;

      const { error: assignmentMoveError } = await supabase.from("assignments").update({ module_day_id: targetDayId }).eq("id", assignmentId);
      if (assignmentMoveError) console.error("Failed to move assignment:", assignmentMoveError);

      setModules((prev) =>
        prev.map((m) => ({
          ...m,
          module_days: m.module_days.map((d) => {
            if (d.id === sourceDayId) {
              return { ...d, assignments: (d.assignments ?? []).filter((a) => a.id !== assignmentId) };
            }
            if (d.id === targetDayId) {
              return { ...d, assignments: [...(d.assignments ?? []), { ...assignmentToMove!, module_day_id: targetDayId }] };
            }
            return d;
          }),
        }))
      );
      return;
    }

    if (active.id === over.id) return;
    if (activeData?.type !== overData?.type) return;

    const currentModules = modulesRef.current;

    if (activeData?.type === "module") {
      const oldIndex = currentModules.findIndex(
        (m) => `module-${m.id}` === active.id
      );
      const newIndex = currentModules.findIndex(
        (m) => `module-${m.id}` === over.id
      );
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove([...currentModules], oldIndex, newIndex);
      setModules(reordered);

      await Promise.all(
        reordered.map((m, i) =>
          supabase.from("modules").update({ order: i }).eq("id", m.id)
        )
      );
      return;
    }

    if (activeData?.type === "day") {
      const moduleId = activeData.moduleId;
      const mod = modulesRef.current.find((m) => m.id === moduleId);
      if (!mod) return;

      const oldIndex = mod.module_days.findIndex(
        (d) => `day-${d.id}` === active.id
      );
      const newIndex = mod.module_days.findIndex(
        (d) => `day-${d.id}` === over.id
      );
      if (oldIndex === -1 || newIndex === -1) return;

      const reorderedDays = arrayMove([...mod.module_days], oldIndex, newIndex).map(
        (d, i) => ({ ...d, order: i })
      );

      setTimeout(() => {
        setModules((prev) =>
          prev.map((m) =>
            m.id === moduleId ? { ...m, module_days: reorderedDays } : m
          )
        );
      }, 10);

      await Promise.all(
        reorderedDays.map((d, i) =>
          supabase.from("module_days").update({ order: i }).eq("id", d.id)
        )
      );
    }
  };

  const addModule = async () => {
    if (!newModuleTitle.trim()) return;

    const { data, error } = await supabase
      .from("modules")
      .insert({
        course_id: course.id,
        title: newModuleTitle.trim(),
        week_number: parseInt(newModuleWeek) || modules.length + 1,
        order: modules.length,
      })
      .select()
      .single();

    if (!error && data) {
      setModules((prev) => [...prev, { ...data, module_days: [] }]);
      setNewModuleTitle("");
      setNewModuleWeek("");
    }
  };

  const deleteModule = async (id: string) => {
    await supabase.from("modules").delete().eq("id", id);
    setModules((prev) => prev.filter((m) => m.id !== id));
  };

  const addDay = async (moduleId: string, dayName: string) => {
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;

    const { data, error } = await supabase
      .from("module_days")
      .insert({
        module_id: moduleId,
        day_name: dayName,
        order: mod.module_days.length,
      })
      .select()
      .single();

    if (!error && data) {
      setModules((prev) =>
        prev.map((m) =>
          m.id === moduleId
            ? { ...m, module_days: [...m.module_days, { ...data, assignments: [] }] }
            : m
        )
      );
    }
  };

  const deleteDay = async (dayId: string, moduleId: string) => {
    await supabase.from("module_days").delete().eq("id", dayId);

    setModules((prev) =>
      prev.map((m) =>
        m.id === moduleId
          ? { ...m, module_days: m.module_days.filter((d) => d.id !== dayId) }
          : m
      )
    );
  };

  return (
    <>
      {isMounted && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-col gap-4">
            <SortableContext
              items={modules.map((m) => `module-${m.id}`)}
              strategy={verticalListSortingStrategy}
            >
              {modules.map((module) => (
                <SortableModule
                  key={module.id}
                  module={module}
                  onDelete={deleteModule}
                  onAddDay={addDay}
                  onDeleteDay={deleteDay}
                />
              ))}
            </SortableContext>

            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-6">
              <h4 className="text-sm font-medium text-dark-text mb-3">
                Add Module
              </h4>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Module title (e.g. Week 1: Intro)"
                  value={newModuleTitle}
                  onChange={(e) => setNewModuleTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addModule();
                  }}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary"
                  aria-label="Module title"
                />
                <input
                  type="number"
                  placeholder="Week #"
                  value={newModuleWeek}
                  onChange={(e) => setNewModuleWeek(e.target.value)}
                  className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary"
                  aria-label="Week number"
                />
                <button
                  onClick={addModule}
                  className="bg-teal-primary text-white px-5 py-2 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity"
                  type="button"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </DndContext>
      )}
    </>
  );
}