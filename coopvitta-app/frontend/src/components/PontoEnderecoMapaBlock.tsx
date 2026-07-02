import type { ReactNode } from 'react';
import { PontoLocationMap } from './PontoLocationMap';
import type { PontoEnderecoMapaApi } from '../hooks/usePontoEnderecoMapa';

type PontoEnderecoMapaBlockProps = {
  geo: PontoEnderecoMapaApi;
  /** Título opcional (ex.: heading da seção). */
  title?: string;
  titleClassName?: string;
  intro?: ReactNode;
};

export function PontoEnderecoMapaBlock({
  geo,
  title,
  titleClassName = 'text-base font-bold text-coop-900 mb-2',
  intro,
}: PontoEnderecoMapaBlockProps) {
  const {
    enderecoDisplay,
    onEnderecoInputChange,
    enderecoContainerRef,
    enderecoBuscando,
    enderecoDropdownOpen,
    setEnderecoDropdownOpen,
    enderecoSugestoes,
    selecionarEndereco,
    geocoding,
    buscarCoordenadas,
    usarMinhaLocalizacao,
    enderecoBuscaHits,
    aplicarEnderecoGeocodificado,
    latitudeMap,
    longitudeMap,
    raioMapNum,
    onMapPositionChange,
    mapViewRevision,
    geocodeError,
    temCoordenadas,
    latitudeDisplay,
    longitudeDisplay,
  } = geo;

  return (
    <>
      {title ? <h4 className={titleClassName}>{title}</h4> : null}
      {intro}
      <div className="flex flex-wrap items-end gap-4 p-4 rounded-xl border border-coop-200 bg-coop-50/30">
        <div className="min-w-[280px] flex-1 relative" ref={enderecoContainerRef}>
          <label className="block text-sm font-semibold text-coop-800 mb-1">Endereço</label>
          <input
            type="text"
            className="input w-full"
            placeholder="Digite para buscar (ex.: Rua X, 123 - Fortaleza/CE)"
            value={enderecoDisplay}
            onChange={(e) => onEnderecoInputChange(e.target.value)}
            onFocus={() => enderecoSugestoes.length > 0 && setEnderecoDropdownOpen(true)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              setEnderecoDropdownOpen(false);
              void buscarCoordenadas();
            }}
            autoComplete="off"
          />
          {enderecoBuscando && <p className="text-xs text-coop-600 mt-1">Buscando endereços...</p>}
          {enderecoDropdownOpen && enderecoSugestoes.length > 0 && (
            <ul className="absolute z-50 left-0 right-0 mt-1 py-1 bg-white border border-coop-200 rounded-lg shadow-lg max-h-48 overflow-auto">
              {enderecoSugestoes.map((item, i) => (
                <li
                  key={`${item.lat}-${item.lon}-${i}`}
                  role="option"
                  className="px-3 py-2 text-sm text-coop-800 cursor-pointer hover:bg-coop-100 truncate"
                  onClick={() => selecionarEndereco(item)}
                >
                  {item.display_name}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void buscarCoordenadas()}
          disabled={geocoding}
        >
          {geocoding ? 'Buscando...' : 'Pesquisar no mapa'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={usarMinhaLocalizacao}>
          Usar minha localização atual
        </button>
      </div>
      {enderecoBuscaHits.length > 1 ? (
        <div className="mt-3 p-3 rounded-xl border border-coop-200 bg-coop-50/50">
          <p className="text-xs font-semibold text-coop-800 mb-2">
            Resultados da pesquisa — clique para mostrar no mapa:
          </p>
          <ul className="space-y-1 max-h-40 overflow-y-auto text-sm">
            {enderecoBuscaHits.map((item, i) => (
              <li key={`${item.lat}-${item.lon}-${i}`}>
                <button
                  type="button"
                  className="text-left w-full px-2 py-1.5 rounded-lg hover:bg-coop-100 text-coop-900 border border-transparent hover:border-coop-200"
                  onClick={() => aplicarEnderecoGeocodificado(item, { hits: enderecoBuscaHits })}
                >
                  {item.display_name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-3 mb-1">
        <PontoLocationMap
          latitude={latitudeMap}
          longitude={longitudeMap}
          radiusMeters={raioMapNum}
          onPositionChange={onMapPositionChange}
          viewRevision={mapViewRevision}
        />
      </div>
      {geocodeError && <p className="text-sm text-red-600 mt-2">{geocodeError}</p>}
      {temCoordenadas && (
        <p className="text-sm text-coop-700 mt-2">
          Coordenadas definidas: {latitudeDisplay}, {longitudeDisplay}
        </p>
      )}
    </>
  );
}
