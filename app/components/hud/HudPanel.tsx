import type { CSSProperties, ReactNode } from "react";

/**
 * Angular, edge-lit panel shared by both side rails. `tone` distinguishes the
 * cyan control rail from the magenta intelligence rail; `order` staggers the
 * boot-in animation.
 */
export default function HudPanel({
  code,
  title,
  tone,
  order = 0,
  actions,
  className = "",
  children,
}: {
  code: string;
  title: string;
  tone: "cyan" | "magenta";
  order?: number;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const id = `panel-${code.replace(/\W/g, "")}`;
  return (
    <section
      className={`hud-panel tone-${tone} ${className}`}
      style={{ "--order": order } as CSSProperties}
      aria-labelledby={id}
    >
      <div className="hud-frame">
        <div className="hud-inner">
          <header className="hud-head">
            <span className="hud-code" aria-hidden="true">
              {code}
            </span>
            <h2 id={id}>{title}</h2>
            {actions && <div className="hud-actions">{actions}</div>}
          </header>
          <div className="hud-body">{children}</div>
        </div>
      </div>
      <i className="hud-tick tick-tl" aria-hidden="true" />
      <i className="hud-tick tick-br" aria-hidden="true" />
    </section>
  );
}
