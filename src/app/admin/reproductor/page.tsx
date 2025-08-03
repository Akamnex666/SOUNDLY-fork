'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/components/SupabaseProvider';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  MusicalNoteIcon,
  PlayIcon,
  PauseIcon,
  ForwardIcon,
  BackwardIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  HeartIcon,
  ShareIcon,
  QueueListIcon,
  ArrowPathIcon,
  EllipsisHorizontalIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';

/**
 * Interfaces para tipado de datos
 */
interface Cancion {
  id: string;
  titulo: string;
  artista: string;
  album?: string;
  duracion: number;
  genero?: string;
  imagen_url?: string;
  archivo_audio_url?: string;
  es_favorita?: boolean;
  reproducciones?: number;
  fecha_lanzamiento?: string;
}

interface Playlist {
  id: string;
  nombre: string;
  descripcion?: string;
  canciones: Cancion[];
  imagen_url?: string;
}

type ModoRepetir = 'off' | 'one' | 'all';

/**
 * Página del Reproductor Musical - Interfaz completa de reproducción
 * 
 * Características principales:
 * - Reproductor de audio completo con controles avanzados
 * - Lista de reproducción actual
 * - Información detallada de la canción
 * - Controles de favoritos y compartir
 * - Visualizador de ecualizador (simulado)
 * - Historial de reproducción
 * - Modo aleatorio y repetición
 */
export default function ReproductorPage() {
  const { supabase } = useSupabase();
  const router = useRouter();
  const { 
    currentSong, 
    isPlaying, 
    volume, 
    playlist, 
    nextSong, 
    previousSong, 
    playSong,
    pauseSong,
    resumeSong,
    setVolume
  } = useMusicPlayer();

  // Estados locales para la UI
  const [mostrarPlaylist, setMostrarPlaylist] = useState(true);
  const [usuario, setUsuario] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState('off');

  // Estados para visualizador
  const [barrasEcualizador, setBarrasEcualizador] = useState<Array<{ id: string; altura: number }>>([]);

  useEffect(() => {
    verificarUsuarioYCargarDatos();
    generarVisualizador();
  }, []);

  // Generar barras del ecualizador animadas
  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setBarrasEcualizador(
          Array.from({ length: 20 }, (_, index) => ({
            id: `barra-${index}`,
            altura: Math.random() * 100
          }))
        );
      }, 150);
      return () => clearInterval(interval);
    }
  }, [isPlaying]);

  /**
   * Verificar usuario autenticado y cargar datos musicales
   */
  const verificarUsuarioYCargarDatos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/auth/login?redirectTo=/dashboard/reproductor');
        return;
      }

      // Obtener datos del usuario
      const { data: userData } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!userData) {
        router.push('/auth/login');
        return;
      }

      setUsuario(userData);
      await cargarPlaylistPorDefecto();
      
    } catch (error) {
      console.error('Error verificando usuario:', error);
      router.push('/auth/login');
    } finally {
      setCargando(false);
    }
  };

  /**
   * Cargar playlist por defecto con canciones de ejemplo
   */
  const cargarPlaylistPorDefecto = async () => {
    try {
      // En una implementación real, aquí cargarías las canciones del usuario/trending
      const playlistEjemplo: Cancion[] = [
        {
          id: '1',
          titulo: 'Midnight Dreams',
          artista: 'Luna Nova',
          album: 'Nocturnal Vibes',
          duracion: 210,
          genero: 'Electronic',
          imagen_url: '/api/placeholder/300/300',
          es_favorita: true,
          reproducciones: 12450,
          fecha_lanzamiento: '2024-03-15'
        },
        {
          id: '2', 
          titulo: 'Summer Breeze',
          artista: 'Ocean Waves',
          album: 'Coastal Sounds',
          duracion: 185,
          genero: 'Chill',
          es_favorita: false,
          reproducciones: 8320,
          fecha_lanzamiento: '2024-02-20'
        },
        {
          id: '3',
          titulo: 'Electric Storm',
          artista: 'Neon Lights',
          album: 'Synthwave Collection',
          duracion: 245,
          genero: 'Synthwave',
          es_favorita: true,
          reproducciones: 15670,
          fecha_lanzamiento: '2024-01-10'
        },
        {
          id: '4',
          titulo: 'Peaceful Morning',
          artista: 'Zen Garden',
          album: 'Meditation Sounds',
          duracion: 320,
          genero: 'Ambient',
          es_favorita: false,
          reproducciones: 5890,
          fecha_lanzamiento: '2024-04-01'
        },
        {
          id: '5',
          titulo: 'City Lights',
          artista: 'Urban Pulse',
          album: 'Metropolitan',
          duracion: 195,
          genero: 'Hip Hop',
          es_favorita: true,
          reproducciones: 22340,
          fecha_lanzamiento: '2024-03-28'
        }
      ];

      // Cargar playlist en el contexto global en lugar de estado local
      // setPlaylist y setCancionActual ya no son necesarios aquí
      // La lógica se maneja en el contexto
    } catch (error) {
      console.error('Error cargando playlist:', error);
    }
  };

  /**
   * Generar barras iniciales del ecualizador
   */
  const generarVisualizador = () => {
    const numeroBarras = 20;
    const barras = Array.from({ length: numeroBarras }, (_, index) => ({
      id: `barra-${index}`,
      altura: Math.random() * 60 + 10
    }));
    setBarrasEcualizador(barras);
  };

  /**
   * Seleccionar canción específica de la playlist
   */
  const seleccionarCancion = (cancion: any, indice: number) => {
    playSong(cancion, playlist);
  };

  /**
   * Toggle favorito de la canción actual
   */
  const toggleFavorito = async () => {
    if (!currentSong) return;
    // Esta funcionalidad se implementará más tarde con la base de datos
    console.log('Toggle favorito para:', currentSong.titulo);
  };

  /**
   * Toggle reproducción
   */
  const togglePlayPause = () => {
    if (isPlaying) {
      pauseSong();
    } else {
      resumeSong();
    }
  };

  /**
   * Toggle mute
   */
  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  /**
   * Toggle shuffle
   */
  const toggleShuffle = () => {
    setIsShuffled(!isShuffled);
  };

  /**
   * Toggle repeat
   */
  const toggleRepeat = () => {
    const modes = ['off', 'one', 'all'];
    const currentIndex = modes.indexOf(repeatMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setRepeatMode(nextMode);
  };

  /**
   * Formatear duración en MM:SS
   */
  const formatearDuracion = (segundos: number) => {
    const minutos = Math.floor(segundos / 60);
    const segs = segundos % 60;
    return `${minutos}:${segs.toString().padStart(2, '0')}`;
  };

  /**
   * Formatear número con separadores de miles
   */
  const formatearNumero = (numero: number) => {
    return numero.toLocaleString('es-ES');
  };

  /**
   * Obtener título del modo de repetición
   */
  const getRepeatModeTitle = (modo: string) => {
    switch (modo) {
      case 'off': return 'Sin repetición';
      case 'one': return 'Repetir canción';
      case 'all': return 'Repetir playlist';
      default: return 'Sin repetición';
    }
  };  /**
   * Renderizar indicador de reproducción en playlist
   */
  const renderPlaylistIndicator = (cancion: Cancion, isCurrentSong: boolean, index: number) => {
    if (isCurrentSong) {
      return isPlaying ? (
        <div className="flex space-x-1 justify-center">
          <div className="w-1 h-4 bg-purple-600 animate-pulse"></div>
          <div className="w-1 h-4 bg-purple-600 animate-pulse" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-1 h-4 bg-purple-600 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
        </div>
      ) : (
        <PauseIcon className="w-4 h-4 text-purple-600 mx-auto" />
      );
    }
    return <span className="text-sm text-gray-400">{index + 1}</span>;
  };

  if (cargando) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">Cargando reproductor...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header del Reproductor */}
        <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-purple-700 rounded-2xl p-8 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <MusicalNoteIcon className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Reproductor Musical</h1>
                <p className="text-purple-100 mt-1">
                  Disfruta de tu música con calidad premium
                </p>
              </div>
            </div>
            
            {/* Estadísticas rápidas */}
            <div className="hidden md:flex space-x-6 text-center">
              <div>
                <div className="text-2xl font-bold">{playlist.length}</div>
                <div className="text-sm text-purple-200">En cola</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{usuario?.rol === 'premium' ? 'HD' : 'STD'}</div>
                <div className="text-sm text-purple-200">Calidad</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Columna Principal - Reproductor */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Información de la Canción Actual */}
            {currentSong && (
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="md:flex">
                  
                  {/* Imagen del álbum */}
                  <div className="md:w-80 h-80 bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 flex items-center justify-center relative overflow-hidden">
                    <div className="text-center text-white">
                      <MusicalNoteIcon className="w-24 h-24 mx-auto mb-4 opacity-80" />
                      <p className="text-lg font-medium opacity-90">{currentSong.album || 'Sin álbum'}</p>
                    </div>
                    
                    {/* Overlay con controles */}
                    <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <button 
                        onClick={togglePlayPause}
                        className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition-transform"
                      >
                        {isPlaying ? <PauseIcon className="w-8 h-8" /> : <PlayIcon className="w-8 h-8 ml-1" />}
                      </button>
                    </div>
                  </div>
                  
                  {/* Información detallada */}
                  <div className="flex-1 p-8">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">
                          {currentSong.titulo}
                        </h2>
                        <p className="text-xl text-gray-600 mb-1">{currentSong.artista}</p>
                        <p className="text-gray-500">{currentSong.album}</p>
                      </div>
                      
                      {/* Acciones rápidas */}
                      <div className="flex space-x-2">
                        <button
                          onClick={toggleFavorito}
                          className="p-3 rounded-full transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200"
                          title="Agregar a favoritos"
                        >
                          <HeartIcon className="w-5 h-5" />
                        </button>
                        
                        <button className="p-3 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                          <ShareIcon className="w-5 h-5" />
                        </button>
                        
                        <button className="p-3 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                          <EllipsisHorizontalIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Metadata de la canción */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Duración:</span>
                        <span className="ml-2 font-medium">{formatearDuracion(currentSong.duracion)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Género:</span>
                        <span className="ml-2 font-medium">{currentSong.genero || 'No especificado'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Bitrate:</span>
                        <span className="ml-2 font-medium">{currentSong.bitrate || 320} kbps</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Álbum:</span>
                        <span className="ml-2 font-medium">{currentSong.album || 'No especificado'}</span>
                      </div>
                    </div>
                    
                    {/* Tags de calidad */}
                    <div className="flex space-x-2 mt-6">
                      {usuario?.rol === 'premium' && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800">
                          💎 Calidad HD
                        </span>
                      )}
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        🎵 {currentSong.genero}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Visualizador de Audio */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <SpeakerWaveIcon className="w-5 h-5 mr-2 text-purple-600" />
                Visualizador de Audio
              </h3>
              
              <div className="h-32 bg-gray-900 rounded-lg p-4 flex items-end justify-center space-x-1">
                {barrasEcualizador.map((barra) => (
                  <div
                    key={barra.id}
                    className="bg-gradient-to-t from-purple-500 to-pink-500 rounded-sm transition-all duration-150"
                    style={{
                      height: `${isPlaying ? barra.altura : 10}%`,
                      width: '4px'
                    }}
                  />
                ))}
              </div>
              
              <div className="mt-4 text-center text-sm text-gray-500">
                {isPlaying ? '🎵 Reproduciendo...' : '⏸️ En pausa'}
              </div>
            </div>
          </div>
          
          {/* Columna Lateral - Playlist y Controles */}
          <div className="space-y-6">
            
            {/* Panel de Control */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Controles</h3>
              
              {/* Controles principales */}
              <div className="flex justify-center space-x-4 mb-6">
                <button
                  onClick={previousSong}
                  className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                  title="Anterior"
                >
                  <BackwardIcon className="w-6 h-6" />
                </button>
                
                <button
                  onClick={togglePlayPause}
                  className="p-4 rounded-full bg-purple-600 hover:bg-purple-700 text-white transition-colors transform hover:scale-105"
                  title={isPlaying ? 'Pausar' : 'Reproducir'}
                >
                  {isPlaying ? <PauseIcon className="w-8 h-8" /> : <PlayIcon className="w-8 h-8 ml-1" />}
                </button>
                
                <button
                  onClick={nextSong}
                  className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                  title="Siguiente"
                >
                  <ForwardIcon className="w-6 h-6" />
                </button>
              </div>
              
              {/* Modos de reproducción */}
              <div className="flex justify-center space-x-4 mb-6">
                <button
                  onClick={toggleShuffle}
                  className={`p-2 rounded-lg transition-colors ${
                    isShuffled 
                      ? 'bg-purple-100 text-purple-700' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title="Modo aleatorio"
                >
                  🔀
                </button>
                
                <button
                  onClick={toggleRepeat}
                  className={`p-2 rounded-lg transition-colors ${
                    repeatMode !== 'off' 
                      ? 'bg-purple-100 text-purple-700' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title={getRepeatModeTitle(repeatMode)}
                >
                  <ArrowPathIcon className="w-5 h-5" />
                  {repeatMode === 'one' && <span className="absolute -top-1 -right-1 w-3 h-3 bg-purple-600 rounded-full text-xs text-white flex items-center justify-center">1</span>}
                </button>
              </div>
              
              {/* Control de volumen */}
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <button 
                    onClick={toggleMute}
                    className="text-gray-600 hover:text-gray-800"
                  >
                    {isMuted || volume === 0 ? (
                      <SpeakerXMarkIcon className="w-5 h-5" />
                    ) : (
                      <SpeakerWaveIcon className="w-5 h-5" />
                    )}
                  </button>
                  
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      const nuevoVolumen = parseFloat(e.target.value);
                      setVolume(nuevoVolumen);
                    }}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  
                  <span className="text-sm text-gray-500 min-w-[3rem]">
                    {Math.round((isMuted ? 0 : volume) * 100)}%
                  </span>
                </div>
              </div>
            </div>
            
            {/* Playlist Actual */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <QueueListIcon className="w-5 h-5 mr-2 text-purple-600" />
                  Cola de Reproducción
                </h3>
                <button
                  onClick={() => setMostrarPlaylist(!mostrarPlaylist)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  {mostrarPlaylist ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              
              {mostrarPlaylist && (
                <div className="max-h-96 overflow-y-auto">
                  {playlist.map((cancion, indice) => {
                    const isCurrentSong = currentSong?.id === cancion.id;
                    return (
                      <button
                        key={cancion.id}
                        onClick={() => seleccionarCancion(cancion, indice)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            seleccionarCancion(cancion, indice);
                          }
                        }}
                        className={`w-full p-4 border-b border-gray-100 transition-colors hover:bg-gray-50 text-left ${
                          isCurrentSong ? 'bg-purple-50 border-purple-200' : ''
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          {/* Indicador de reproducción */}
                          <div className="w-8 text-center">
                            {renderPlaylistIndicator(cancion, isCurrentSong, indice)}
                          </div>
                          
                          {/* Información de la canción */}
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium truncate ${
                              isCurrentSong ? 'text-purple-700' : 'text-gray-900'
                            }`}>
                              {cancion.titulo}
                            </p>
                            <p className="text-sm text-gray-600 truncate">{cancion.artista}</p>
                          </div>
                          
                          {/* Duración */}
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-500">{formatearDuracion(cancion.duracion)}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
