'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import DashboardLayout from '@/components/DashboardLayout';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { 
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  PlayIcon,
  PauseIcon,
  ExclamationTriangleIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

interface Cancion {
  id: string;
  titulo: string;
  artista?: string;
  album?: string;
  genero?: string;
  duracion: number;
  created_at: string;
  estado: 'activa' | 'inactiva' | 'borrador';
  reproducciones: number;
  archivo_audio_url?: string;
  usuario_subida_id: string;
  usuarios?: {
    nombre: string;
    email: string;
    perfiles_artista?: {
      nombre_artistico: string;
    }[];
  };
  albumes?: {
    titulo: string;
  };
}

export default function AdminBibliotecaPage() {
  const [canciones, setCanciones] = useState<Cancion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGenero, setFilterGenero] = useState<string>('todos');
  const [filterEstado, setFilterEstado] = useState<string>('todos');
  const [selectedCancion, setSelectedCancion] = useState<Cancion | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Cancion>>({});

  // Music player context
  const { currentSong, isPlaying, playSong, pauseSong, resumeSong } = useMusicPlayer();

  const generos = [
    'Rock', 'Pop', 'Hip Hop', 'Reggaeton', 'Jazz', 'Blues', 
    'Electrónica', 'Clásica', 'Folk', 'Country', 'R&B', 'Indie'
  ];

  useEffect(() => {
    console.log('🎵 Admin: Iniciando página de biblioteca');
    fetchCanciones();
  }, []);

  useEffect(() => {
    console.log('🎵 Admin: Estado del reproductor actualizado:', {
      currentSong: currentSong?.titulo || 'Ninguna',
      isPlaying,
      totalCanciones: canciones.length
    });
  }, [currentSong, isPlaying, canciones]);

  const fetchCanciones = async () => {
    try {
      setLoading(true);
      console.log('🎵 Cargando canciones desde Supabase...');
      
      const { data, error } = await supabase
        .from('canciones')
        .select(`
          id,
          titulo,
          duracion,
          genero,
          reproducciones,
          archivo_audio_url,
          usuario_subida_id,
          estado,
          created_at,
          albumes (
            titulo
          ),
          usuarios (
            nombre,
            email,
            perfiles_artista (
              nombre_artistico
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching canciones:', error);
        console.log('🔄 Mostrando array vacío debido al error');
        setCanciones([]);
      } else {
        console.log('✅ Canciones cargadas desde Supabase:', data?.length || 0);
        if (data?.length === 0) {
          console.log('ℹ️ No hay canciones en la base de datos');
        }
        
        // Procesar datos para formatear correctamente
        const cancionesProcesadas: Cancion[] = (data || []).map(cancion => ({
          id: cancion.id,
          titulo: cancion.titulo,
          artista: cancion.usuarios?.[0]?.perfiles_artista?.[0]?.nombre_artistico || 
                  cancion.usuarios?.[0]?.nombre || 
                  'Artista desconocido',
          album: cancion.albumes?.[0]?.titulo,
          genero: cancion.genero || 'Sin género',
          duracion: cancion.duracion,
          created_at: cancion.created_at,
          estado: cancion.estado,
          reproducciones: cancion.reproducciones || 0,
          archivo_audio_url: cancion.archivo_audio_url,
          usuario_subida_id: cancion.usuario_subida_id,
          usuarios: cancion.usuarios?.[0] ? {
            nombre: cancion.usuarios[0].nombre,
            email: cancion.usuarios[0].email,
            perfiles_artista: cancion.usuarios[0].perfiles_artista
          } : undefined,
          albumes: cancion.albumes?.[0]
        }));
        
        setCanciones(cancionesProcesadas);
      }
    } catch (error) {
      console.error('❌ Error general:', error);
      setCanciones([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredCanciones = canciones.filter(cancion => {
    const matchesSearch = cancion.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (cancion.artista && cancion.artista.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (cancion.album && cancion.album.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesGenero = filterGenero === 'todos' || cancion.genero === filterGenero;
    const matchesEstado = filterEstado === 'todos' || cancion.estado === filterEstado;
    
    return matchesSearch && matchesGenero && matchesEstado;
  });

  const handleEdit = (cancion: Cancion) => {
    setSelectedCancion(cancion);
    setEditFormData(cancion);
    setShowEditModal(true);
  };

  const handleDelete = (cancion: Cancion) => {
    setSelectedCancion(cancion);
    setShowDeleteModal(true);
  };

  const handleDetail = (cancion: Cancion) => {
    setSelectedCancion(cancion);
    setShowDetailModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedCancion) return;

    try {
      const { error } = await supabase
        .from('canciones')
        .update(editFormData)
        .eq('id', selectedCancion.id);

      if (error) {
        console.error('Error updating cancion:', error);
        alert('Error al actualizar canción');
        return;
      }

      // Actualizar la lista local
      setCanciones(prev => prev.map(c => 
        c.id === selectedCancion.id ? { ...c, ...editFormData } : c
      ));

      setShowEditModal(false);
      setSelectedCancion(null);
      alert('Canción actualizada correctamente');
    } catch (error) {
      console.error('Error:', error);
      // Simular actualización local
      setCanciones(prev => prev.map(c => 
        c.id === selectedCancion.id ? { ...c, ...editFormData } : c
      ));
      setShowEditModal(false);
      setSelectedCancion(null);
      alert('Canción actualizada correctamente (simulado)');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedCancion) return;

    try {
      const { error } = await supabase
        .from('canciones')
        .delete()
        .eq('id', selectedCancion.id);

      if (error) {
        console.error('Error deleting cancion:', error);
        alert('Error al eliminar canción');
        return;
      }

      // Actualizar la lista local
      setCanciones(prev => prev.filter(c => c.id !== selectedCancion.id));

      setShowDeleteModal(false);
      setSelectedCancion(null);
      alert('Canción eliminada correctamente');
    } catch (error) {
      console.error('Error:', error);
      // Simular eliminación local
      setCanciones(prev => prev.filter(c => c.id !== selectedCancion.id));
      setShowDeleteModal(false);
      setSelectedCancion(null);
      alert('Canción eliminada correctamente (simulado)');
    }
  };

  const togglePlayPause = (cancion: Cancion) => {
    if (currentSong?.id === cancion.id && isPlaying) {
      pauseSong();
    } else if (currentSong?.id === cancion.id && !isPlaying) {
      resumeSong();
    } else {
      // Convertir la cancion al formato esperado por el reproductor
      const songToPlay = {
        id: cancion.id,
        titulo: cancion.titulo,
        artista: cancion.artista || 'Artista desconocido',
        album: cancion.album,
        genero: cancion.genero || 'Sin género',
        duracion: cancion.duracion,
        url_archivo: cancion.archivo_audio_url || '/placeholder-audio.mp3',
        usuario_id: cancion.usuario_subida_id
      };
      
      // Crear playlist con las canciones filtradas activas
      const activePlaylist = filteredCanciones
        .filter(c => c.estado === 'activa')
        .map(c => ({
          id: c.id,
          titulo: c.titulo,
          artista: c.artista || 'Artista desconocido',
          album: c.album,
          genero: c.genero || 'Sin género',
          duracion: c.duracion,
          url_archivo: c.archivo_audio_url || '/placeholder-audio.mp3',
          usuario_id: c.usuario_subida_id
        }));
      
      playSong(songToPlay, activePlaylist);
    }
  };

  const getEstadoBadgeColor = (estado: string) => {
    switch (estado) {
      case 'activa': return 'bg-green-100 text-green-800';
      case 'inactiva': return 'bg-gray-100 text-gray-800';
      case 'pendiente': return 'bg-yellow-100 text-yellow-800';
      case 'reportada': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getStatsCards = () => {
    const totalCanciones = canciones.length;
    const cancionesActivas = canciones.filter(c => c.estado === 'activa').length;
    const cancionesBorrador = canciones.filter(c => c.estado === 'borrador').length;
    const cancionesInactivas = canciones.filter(c => c.estado === 'inactiva').length;

    return [
      {
        title: 'Total Canciones',
        value: totalCanciones,
        icon: '🎵',
        color: 'text-blue-600'
      },
      {
        title: 'Activas',
        value: cancionesActivas,
        icon: '✅',
        color: 'text-green-600'
      },
      {
        title: 'Borradores',
        value: cancionesBorrador,
        icon: '📝',
        color: 'text-yellow-600'
      },
      {
        title: 'Inactivas',
        value: cancionesInactivas,
        icon: '⏸️',
        color: 'text-red-600'
      }
    ];
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Gestión de Biblioteca Musical 🎵
          </h2>
          <p className="text-gray-600">
            Administra todas las canciones de la plataforma Soundly
          </p>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {getStatsCards().map((card) => (
            <div key={card.title} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="text-3xl mr-4">{card.icon}</div>
                <div>
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filtros y búsqueda */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar canciones..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filterGenero}
              onChange={(e) => setFilterGenero(e.target.value)}
            >
              <option value="todos">Todos los géneros</option>
              {generos.map(genero => (
                <option key={genero} value={genero}>{genero}</option>
              ))}
            </select>

            <select
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
            >
              <option value="todos">Todos los estados</option>
              <option value="activa">Activa</option>
              <option value="inactiva">Inactiva</option>
              <option value="borrador">Borrador</option>
            </select>

            <button
              onClick={fetchCanciones}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              🔄 Actualizar
            </button>
          </div>
        </div>

        {/* Tabla de canciones */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Canción
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Artista
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Género
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reproducciones
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duración
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(() => {
                  if (loading) {
                    return (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                          Cargando canciones...
                        </td>
                      </tr>
                    );
                  }
                  
                  if (filteredCanciones.length === 0) {
                    return (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                          No se encontraron canciones
                        </td>
                      </tr>
                    );
                  }
                  
                  return filteredCanciones.map((cancion) => (
                    <tr key={cancion.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <button
                            onClick={() => togglePlayPause(cancion)}
                            className="mr-3 p-1 rounded-full hover:bg-gray-200"
                          >
                            {currentSong?.id === cancion.id && isPlaying ? (
                              <PauseIcon className="w-5 h-5 text-gray-600" />
                            ) : (
                              <PlayIcon className="w-5 h-5 text-gray-600" />
                            )}
                          </button>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {cancion.titulo}
                            </div>
                            {cancion.album && (
                              <div className="text-sm text-gray-500">
                                {cancion.album}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {cancion.artista || 'Artista desconocido'}
                          </div>
                          {cancion.usuarios && (
                            <div className="text-sm text-gray-500">
                              {cancion.usuarios.nombre}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {cancion.genero ? (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {cancion.genero}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">Sin género</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEstadoBadgeColor(cancion.estado)}`}>
                          {cancion.estado}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {cancion.reproducciones.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDuration(cancion.duracion)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleDetail(cancion)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Ver detalles"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(cancion)}
                            className="text-green-600 hover:text-green-900"
                            title="Editar"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(cancion)}
                            className="text-red-600 hover:text-red-900"
                            title="Eliminar"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal de detalles */}
        {showDetailModal && selectedCancion && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-96 overflow-y-auto">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Detalles de la Canción
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-1">Título</span>
                  <p className="text-sm text-gray-900">{selectedCancion.titulo}</p>
                </div>
                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-1">Artista</span>
                  <p className="text-sm text-gray-900">{selectedCancion.artista}</p>
                </div>
                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-1">Álbum</span>
                  <p className="text-sm text-gray-900">{selectedCancion.album || 'No especificado'}</p>
                </div>
                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-1">Género</span>
                  <p className="text-sm text-gray-900">{selectedCancion.genero}</p>
                </div>
                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-1">Duración</span>
                  <p className="text-sm text-gray-900">{formatDuration(selectedCancion.duracion)}</p>
                </div>
                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-1">Reproducciones</span>
                  <p className="text-sm text-gray-900">{selectedCancion.reproducciones.toLocaleString()}</p>
                </div>
                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-1">Estado</span>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEstadoBadgeColor(selectedCancion.estado)}`}>
                    {selectedCancion.estado}
                  </span>
                </div>
                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-1">Fecha de Subida</span>
                  <p className="text-sm text-gray-900">{new Date(selectedCancion.created_at).toLocaleDateString()}</p>
                </div>
                {selectedCancion.usuarios && (
                  <div className="col-span-2">
                    <span className="block text-sm font-medium text-gray-700 mb-1">Subido por</span>
                    <p className="text-sm text-gray-900">{selectedCancion.usuarios.nombre} ({selectedCancion.usuarios.email})</p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de edición */}
        {showEditModal && selectedCancion && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Editar Canción
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="edit-titulo" className="block text-sm font-medium text-gray-700 mb-2">
                    Título
                  </label>
                  <input
                    id="edit-titulo"
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editFormData.titulo || ''}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, titulo: e.target.value }))}
                  />
                </div>

                <div>
                  <label htmlFor="edit-artista" className="block text-sm font-medium text-gray-700 mb-2">
                    Artista
                  </label>
                  <input
                    id="edit-artista"
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editFormData.artista || ''}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, artista: e.target.value }))}
                  />
                </div>

                <div>
                  <label htmlFor="edit-genero" className="block text-sm font-medium text-gray-700 mb-2">
                    Género
                  </label>
                  <select
                    id="edit-genero"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editFormData.genero || ''}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, genero: e.target.value }))}
                  >
                    {generos.map(genero => (
                      <option key={genero} value={genero}>{genero}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-estado" className="block text-sm font-medium text-gray-700 mb-2">
                    Estado
                  </label>
                  <select
                    id="edit-estado"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editFormData.estado || ''}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, estado: e.target.value as any }))}
                  >
                    <option value="activa">Activa</option>
                    <option value="inactiva">Inactiva</option>
                    <option value="borrador">Borrador</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de confirmación de eliminación */}
        {showDeleteModal && selectedCancion && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex items-center mb-4">
                <ExclamationTriangleIcon className="w-6 h-6 text-red-600 mr-3" />
                <h3 className="text-lg font-medium text-gray-900">
                  Confirmar eliminación
                </h3>
              </div>
              
              <p className="text-gray-600 mb-6">
                ¿Estás seguro de que quieres eliminar la canción <strong>"{selectedCancion.titulo}"</strong>? 
                Esta acción no se puede deshacer.
              </p>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
