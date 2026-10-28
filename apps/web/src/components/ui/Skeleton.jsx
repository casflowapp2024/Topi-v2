// Bloques de carga con la forma del contenido final: evitan que la pantalla salte al cargar.
const Skeleton = ({ className = '', style }) => (
  <span className={`block rounded-lg bg-gray-200/80 dark:bg-gray-700/70 animate-pulse motion-reduce:animate-none ${className}`} style={style} aria-hidden="true" />
);

// Filas tipo lista: ícono, dos líneas de texto y un valor a la derecha.
export const SkeletonRows = ({ rows = 4, withBar = false, className = '' }) => (
  <div className={`flex flex-col gap-4 py-2 ${className}`} role="status" aria-label="Cargando">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Skeleton className="w-6 h-6 rounded-md shrink-0" />
          <div className="flex-1 flex flex-col gap-1.5">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-2.5 w-1/4" />
          </div>
          <Skeleton className="h-3.5 w-16" />
        </div>
        {withBar && <Skeleton className="h-2 w-full rounded-full" />}
      </div>
    ))}
  </div>
);

const HEIGHTS = [55, 70, 45, 85, 60, 75, 50, 65];

// Gráfica de barras genérica mientras llegan los datos.
export const SkeletonChart = ({ bars = 8, className = '' }) => (
  <div className={`flex items-end gap-3 px-6 pb-6 pt-8 w-full h-full ${className}`} role="status" aria-label="Cargando gráfica">
    {Array.from({ length: bars }).map((_, i) => (
      <Skeleton key={i} className="flex-1 rounded-t-md rounded-b-none" style={{ height: `${HEIGHTS[i % HEIGHTS.length]}%` }} />
    ))}
  </div>
);

export default Skeleton;
