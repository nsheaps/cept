export interface BreadcrumbItem {
  id: string;
  title: string;
  icon?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate?: (id: string) => void;
}

export function Breadcrumbs({ items, onNavigate }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav className="cept-breadcrumbs" data-testid="breadcrumbs" aria-label="Breadcrumbs">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={item.id} className="cept-breadcrumb-segment">
            {index > 0 && (
              <span className="cept-breadcrumb-separator" aria-hidden="true">
                /
              </span>
            )}
            {isLast ? (
              <span
                className="cept-breadcrumb-current"
                data-testid={`breadcrumb-${item.id}`}
                aria-current="page"
              >
                {item.title || 'Untitled'}
              </span>
            ) : (
              <button
                className="cept-breadcrumb-link"
                onClick={() => onNavigate?.(item.id)}
                data-testid={`breadcrumb-${item.id}`}
              >
                {item.title || 'Untitled'}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
