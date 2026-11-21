type CargoHoldItem = {id: string; name: string; quantity: number};

export function CargoHoldPanel({
  used, capacity, items, onClose,
}: {used: number; capacity: number; items: CargoHoldItem[]; onClose: () => void}) {
  return (
    <section
      id="space-cargo-hold"
      aria-labelledby="space-cargo-title"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      style={{
        position: 'absolute', top: 49, left: 286, width: 300, maxHeight: 420,
        display: 'flex', flexDirection: 'column', zIndex: 31, overflow: 'hidden',
        background: '#1A2133', color: '#F6EED8', border: '3px solid #0A0E1A',
        borderRadius: 12, boxShadow: '4px 4px 0 #0A0E1A',
      }}
    >
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 10px', background: '#FFB547', color: '#0A0E1A',
      }}>
        <strong id="space-cargo-title" style={{font: '600 16px Fredoka, sans-serif'}}>Cargo Hold</strong>
        <button
          type="button"
          aria-label="Close cargo hold"
          onClick={onClose}
          style={{background: 'transparent', border: 0, fontSize: 19, cursor: 'pointer'}}
        >
          ×
        </button>
      </header>
      <div style={{padding: '6px 10px', font: "700 11px 'JetBrains Mono', monospace"}}>
        {used.toLocaleString()} / {capacity.toLocaleString()} m³ used
      </div>
      {items.length === 0 ? (
        <p style={{margin: 0, padding: '6px 10px 10px', color: '#AEB6CA', fontSize: 13}}>Hold is empty.</p>
      ) : (
        <ul style={{listStyle: 'none', margin: 0, padding: '0 10px 8px', overflowY: 'auto'}}>
          {items.map(({id, name, quantity}) => (
            <li key={id} style={{
              display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0',
              borderBottom: '1px solid #33405F', fontSize: 13,
            }}>
              <span>{name}</span>
              <strong style={{flexShrink: 0, color: '#FFB547'}}>×{quantity.toLocaleString()}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
