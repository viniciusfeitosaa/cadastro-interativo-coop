import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type PontoGeocodeHit = { display_name: string; lat: string; lon: string };

/** Trecho de config de ponto suficiente para fallback de endereço/coords no mapa. */
export type PontoEnderecoConfigLike = {
  enderecoPonto?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  raioMetros?: number | null;
} | null;

const NOMINATIM_HEADERS = {
  'Accept-Language': 'pt-BR',
  'User-Agent': 'GymApp-Ponto/1.0',
} as const;

export function usePontoEnderecoMapa(config: PontoEnderecoConfigLike) {
  const [draftEndereco, setDraftEndereco] = useState('');
  const [draftLatitude, setDraftLatitude] = useState('');
  const [draftLongitude, setDraftLongitude] = useState('');
  const [draftRaioMetros, setDraftRaioMetros] = useState('');
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [enderecoSugestoes, setEnderecoSugestoes] = useState<PontoGeocodeHit[]>([]);
  const [enderecoDropdownOpen, setEnderecoDropdownOpen] = useState(false);
  const [enderecoBuscando, setEnderecoBuscando] = useState(false);
  const enderecoContainerRef = useRef<HTMLDivElement>(null);
  const [mapViewRevision, setMapViewRevision] = useState(0);
  const [enderecoBuscaHits, setEnderecoBuscaHits] = useState<PontoGeocodeHit[]>([]);

  const enderecoDisplay = draftEndereco !== '' ? draftEndereco : (config?.enderecoPonto ?? '');
  const latitudeDisplay =
    draftLatitude !== ''
      ? draftLatitude
      : config?.latitude != null && config?.latitude !== ''
        ? String(config.latitude)
        : '';
  const longitudeDisplay =
    draftLongitude !== ''
      ? draftLongitude
      : config?.longitude != null && config?.longitude !== ''
        ? String(config.longitude)
        : '';
  const raioMetrosDisplay =
    draftRaioMetros !== '' ? draftRaioMetros : config?.raioMetros != null ? String(config.raioMetros) : '';
  const temCoordenadas = latitudeDisplay !== '' && longitudeDisplay !== '';

  const latitudeMap = useMemo(() => {
    const raw =
      draftLatitude !== ''
        ? draftLatitude
        : config?.latitude != null && String(config.latitude).trim() !== ''
          ? String(config.latitude)
          : '';
    if (!raw) return null;
    const n = parseFloat(raw.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }, [draftLatitude, config?.latitude]);

  const longitudeMap = useMemo(() => {
    const raw =
      draftLongitude !== ''
        ? draftLongitude
        : config?.longitude != null && String(config.longitude).trim() !== ''
          ? String(config.longitude)
          : '';
    if (!raw) return null;
    const n = parseFloat(raw.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }, [draftLongitude, config?.longitude]);

  const raioMapNum = useMemo(() => {
    const raw =
      draftRaioMetros !== '' ? draftRaioMetros : config?.raioMetros != null ? String(config.raioMetros) : '';
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [draftRaioMetros, config?.raioMetros]);

  useEffect(() => {
    const query = draftEndereco.trim();
    if (query.length < 3) {
      setEnderecoSugestoes([]);
      setEnderecoDropdownOpen(false);
      return;
    }
    const t = setTimeout(async () => {
      setEnderecoBuscando(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`,
          { headers: NOMINATIM_HEADERS }
        );
        const data = await res.json();
        setEnderecoSugestoes(Array.isArray(data) ? data : []);
        setEnderecoDropdownOpen(true);
      } catch {
        setEnderecoSugestoes([]);
      } finally {
        setEnderecoBuscando(false);
      }
    }, 800);
    return () => clearTimeout(t);
  }, [draftEndereco]);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (enderecoContainerRef.current && !enderecoContainerRef.current.contains(e.target as Node)) {
        setEnderecoDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const resetLocalizacao = useCallback(() => {
    setDraftEndereco('');
    setDraftLatitude('');
    setDraftLongitude('');
    setDraftRaioMetros('');
    setGeocodeError(null);
    setEnderecoSugestoes([]);
    setEnderecoDropdownOpen(false);
    setEnderecoBuscaHits([]);
    setMapViewRevision(0);
  }, []);

  /** Após salvar config completa: mantém rascunho de endereço, limpa só coords/raio (igual fluxo anterior). */
  const limparRascunhoCoordenadasRaio = useCallback(() => {
    setDraftLatitude('');
    setDraftLongitude('');
    setDraftRaioMetros('');
    setGeocodeError(null);
    setEnderecoBuscaHits([]);
  }, []);

  const aplicarEnderecoGeocodificado = useCallback(
    (item: PontoGeocodeHit, options?: { hits?: PontoGeocodeHit[] }) => {
      setDraftEndereco(item.display_name);
      setDraftLatitude(String(Number(item.lat).toFixed(6)));
      setDraftLongitude(String(Number(item.lon).toFixed(6)));
      setEnderecoSugestoes([]);
      setEnderecoDropdownOpen(false);
      setGeocodeError(null);
      if (options?.hits !== undefined) setEnderecoBuscaHits(options.hits);
      setMapViewRevision((n) => n + 1);
    },
    []
  );

  const buscarCoordenadas = useCallback(async () => {
    const disp = (draftEndereco.trim() || String(enderecoDisplay).trim());
    if (!disp) {
      setGeocodeError('Digite um endereço.');
      return;
    }
    if (draftEndereco.trim() === '' && String(enderecoDisplay).trim() !== '') {
      setDraftEndereco(String(enderecoDisplay).trim());
    }
    setGeocoding(true);
    setGeocodeError(null);
    setEnderecoBuscaHits([]);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(disp)}&format=json&addressdetails=1&limit=8`,
        { headers: NOMINATIM_HEADERS }
      );
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        setGeocodeError('Endereço não encontrado. Tente ser mais específico (cidade, estado).');
        return;
      }
      const hits: PontoGeocodeHit[] = data.map((row: { display_name?: string; lat: string; lon: string }) => ({
        display_name: row.display_name ?? disp,
        lat: row.lat,
        lon: row.lon,
      }));
      aplicarEnderecoGeocodificado(hits[0], { hits });
    } catch {
      setGeocodeError('Erro ao buscar coordenadas. Tente novamente.');
    } finally {
      setGeocoding(false);
    }
  }, [draftEndereco, enderecoDisplay, aplicarEnderecoGeocodificado]);

  const selecionarEndereco = useCallback(
    (item: PontoGeocodeHit) => {
      aplicarEnderecoGeocodificado(item, { hits: [] });
    },
    [aplicarEnderecoGeocodificado]
  );

  const usarMinhaLocalizacao = useCallback(() => {
    if (!navigator.geolocation) {
      setGeocodeError('Geolocalização não é suportada neste navegador.');
      return;
    }
    setGeocodeError(null);
    setEnderecoBuscaHits([]);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDraftLatitude(pos.coords.latitude.toFixed(6));
        setDraftLongitude(pos.coords.longitude.toFixed(6));
        setMapViewRevision((n) => n + 1);
      },
      () => setGeocodeError('Não foi possível obter sua localização. Verifique as permissões do navegador.')
    );
  }, []);

  const onMapPositionChange = useCallback((lat: number, lng: number) => {
    setDraftLatitude(lat.toFixed(6));
    setDraftLongitude(lng.toFixed(6));
    setGeocodeError(null);
    setEnderecoBuscaHits([]);
  }, []);

  const onEnderecoInputChange = useCallback((value: string) => {
    setDraftEndereco(value);
    setGeocodeError(null);
    setEnderecoBuscaHits([]);
  }, []);

  return {
    draftEndereco,
    setDraftEndereco,
    draftLatitude,
    setDraftLatitude,
    draftLongitude,
    setDraftLongitude,
    draftRaioMetros,
    setDraftRaioMetros,
    enderecoDisplay,
    latitudeDisplay,
    longitudeDisplay,
    raioMetrosDisplay,
    temCoordenadas,
    latitudeMap,
    longitudeMap,
    raioMapNum,
    mapViewRevision,
    geocodeError,
    geocoding,
    enderecoSugestoes,
    enderecoBuscando,
    enderecoDropdownOpen,
    setEnderecoDropdownOpen,
    enderecoContainerRef,
    enderecoBuscaHits,
    resetLocalizacao,
    limparRascunhoCoordenadasRaio,
    aplicarEnderecoGeocodificado,
    buscarCoordenadas,
    selecionarEndereco,
    usarMinhaLocalizacao,
    onMapPositionChange,
    onEnderecoInputChange,
  };
}

export type PontoEnderecoMapaApi = ReturnType<typeof usePontoEnderecoMapa>;
