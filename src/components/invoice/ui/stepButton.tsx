"use client";
import { getInitialValue } from "@/lib/getInitialValue";
import { Controller } from "react-hook-form";

type StepButtonProps = {
  isPrevious?: boolean;
  title: string;
  step: string;
};

const StepButton = ({ isPrevious, title, step }: StepButtonProps) => (
  <Controller
    render={({ field: { onChange } }) => (
      <div className="w-full flex">
        {isPrevious ? (
          <button
            className="flex-1 hover:bg-ink-50 rounded-xl p-3 md:p-4 border border-ink-100 transition-all group"
            onClick={() => {
              localStorage.setItem("step", step);
              onChange(step);
            }}
          >
            <div className="flex gap-2 items-center mb-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                className="w-4 h-4 text-ink-400 group-hover:text-brand-600 transition-colors"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-[10px] md:text-xs font-bold text-ink-400 uppercase tracking-widest group-hover:text-brand-600 transition-colors">Back</p>
            </div>
            <p className="font-bold text-left text-ink-900 text-sm md:text-base leading-tight truncate">{title}</p>
          </button>
        ) : (
          <button
            onClick={() => {
              localStorage.setItem("step", step);
              onChange(step);
            }}
            className="flex-1 hover:bg-brand-50 rounded-xl p-3 md:p-4 border border-brand-100 transition-all group text-right"
          >
            <div className="flex gap-2 justify-end items-center mb-1">
              <p className="text-[10px] md:text-xs font-bold text-brand-400 uppercase tracking-widest group-hover:text-brand-600 transition-colors">Next</p>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                className="w-4 h-4 text-brand-400 group-hover:text-brand-600 transition-colors"
              >
                <path
                  fillRule="evenodd"
                  d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <p className="font-bold text-brand-950 text-sm md:text-base leading-tight truncate">{title}</p>
          </button>
        )}
      </div>
    )}
    name="step"
    defaultValue={getInitialValue("step") ?? "1"}
  />
);

export default StepButton;
