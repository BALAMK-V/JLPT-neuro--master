export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="pagehead">
      <div>
        <div className="pagehead__title">{title}</div>
        {subtitle ? <div className="pagehead__subtitle">{subtitle}</div> : null}
      </div>
    </div>
  );
}
