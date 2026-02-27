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

type Day = {
  id: string;
  day_name: string;
  order: number;
  module_id: string;
  assignments?: Assignment[];
};

type Module = {
  id: string;
  title: string;
  week_number: number;
  order: number;
  course_id: string;
  module_days: Day[];
};

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
            ({assignments.length})
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
          className="px-10 pb-3 pt-1 border-t border-gray-100"
        >
          {assignments.length === 0 ? (
            <p className="text-xs text-gray-400">No assignments.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {assignments
                .slice()
                .sort((a, b) => {
                  // Put null due dates at the end
                  if (!a.due_date && !b.due_date) return 0;
                  if (!a.due_date) return 1;
                  if (!b.due_date) return -1;
                  return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
                })
                .map((a) => (
                  <li
                    key={a.id}
                    className="bg-white rounded-lg border border-gray-100 px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-dark-text truncate">
                          {a.title}
                        </p>
                        <p className="text-xs text-gray-400">
                          Due:{" "}
                          {a.due_date
                            ? new Date(a.due_date).toLocaleString()
                            : "None"}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
            </ul>
          )}
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
    if (!over || active.id === over.id) return;

    const activeData = active.data.current;
    const overData = over.data.current;
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