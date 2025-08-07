'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/components/SupabaseProvider';
import { useRouter } from 'next/navigation';
import { 
  MusicalNoteIcon, 
  PlusIcon, 
  PencilIcon, 
  TrashIcon,
  PlayIcon,
  PauseIcon,
  ChartBarIcon,
  CloudArrowUpIcon,
  XMarkIcon,
  ExclamationCircleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import DashboardLayout from '@/components/DashboardLayout';

interface Cancion {
  id: string;
  titulo: string;
  duracion: number;
  genero: string;
  año: number;
  archivo_audio_url: string;
  imagen_url?: string;
  letra?: string;
  reproducciones: number;
  es_publica: boolean;
  estado: 'activa' | 'inactiva' | 'borrador';
  created_at: string;
  album_id?: string;
  numero_pista?: number;
  favoritos: number;
  descargas: number;
}

interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'complete' | 'error' | 'editing';
  error?: string;
  metadatos?: {
    titulo: string;
    genero: string;
    albumId?: string;
    duracion: number;
  };
  archivo?: File;
}

export default function MiMusica() {
  const { supabase } = useSupabase();
  const router = useRouter();
  const [canciones, setCanciones] = useState<Cancion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [usuario, setUsuario] = useState<any>(null);
  const [mostrarModalSubida, setMostrarModalSubida] = useState(false);
  const [archivosSubiendo, setArchivosSubiendo] = useState<UploadProgress[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [albumsDisponibles, setAlbumsDisponibles] = useState<any[]>([]);
  const [reproductorActual, setReproductorActual] = useState<{
    cancionId: string;
    isPlaying: boolean;
    audio: HTMLAudioElement | null;
  }>({
    cancionId: '',
    isPlaying: false,
    audio: null
  });

  useEffect(() => {
    verificarUsuarioYCargarMusica();
  }, []);

  const verificarUsuarioYCargarMusica = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/auth/login');
        return;
      }

      // Obtener datos del usuario
      const { data: userData } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!userData || userData.rol !== 'artista') {
        router.push('/dashboard');
        return;
      }

      setUsuario(userData);
      await cargarCanciones(user.id);
      await cargarAlbumsDisponibles(user.id);
    } catch (error) {
      console.error('Error verificando usuario:', error);
    } finally {
      setCargando(false);
    }
  };

  const cargarCanciones = async (userId: string) => {
    try {
      // Cargar canciones reales desde la base de datos
      const { data: cancionesData, error } = await supabase
        .from('canciones')
        .select('*')
        .eq('usuario_subida_id', userId) // Cambiar artista_id por usuario_subida_id
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error cargando canciones:', error);
        return;
      }

      // Verificar y corregir duraciones sospechosas (exactamente 180 segundos)
      const cancionesCorregidas = await Promise.all(
        (cancionesData || []).map(async (cancion) => {
          // Si la duración es exactamente 180 segundos (3:00), intentar obtener la real
          if (cancion.duracion === 180 && cancion.archivo_audio_url) {
            try {
              const duracionReal = await obtenerDuracionDesdeURL(cancion.archivo_audio_url);
              if (duracionReal && duracionReal !== 180) {
                // Actualizar en la base de datos
                await supabase
                  .from('canciones')
                  .update({ duracion: duracionReal })
                  .eq('id', cancion.id);
                
                console.log(`Duración corregida para "${cancion.titulo}": ${duracionReal}s`);
                return { ...cancion, duracion: duracionReal };
              }
            } catch (error) {
              console.error(`Error al corregir duración para "${cancion.titulo}":`, error);
              // Continuar con el siguiente archivo sin detener el proceso
            }
          }
          return cancion;
        })
      );

      setCanciones(cancionesCorregidas);
    } catch (error) {
      console.error('Error cargando canciones:', error);
    }
  };

  const cargarAlbumsDisponibles = async (userId: string) => {
    try {
      const { data: albumsData, error } = await supabase
        .from('albumes')
        .select('id, titulo')
        .eq('usuario_id', userId)
        .order('titulo', { ascending: true });

      if (error) {
        console.error('Error cargando álbumes:', error);
        return;
      }

      setAlbumsDisponibles(albumsData || []);
    } catch (error) {
      console.error('Error cargando álbumes:', error);
    }
  };

  // Función para obtener duración real desde URL del archivo
  const obtenerDuracionDesdeURL = (url: string): Promise<number | null> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      
      audio.addEventListener('loadedmetadata', () => {
        const duracion = Math.floor(audio.duration);
        if (!isNaN(duracion) && duracion > 0) {
          resolve(duracion);
        } else {
          resolve(null);
        }
      });

      audio.addEventListener('error', () => {
        resolve(null);
      });

      // Timeout para evitar que se cuelgue
      setTimeout(() => {
        resolve(null);
      }, 10000); // 10 segundos

      audio.src = url;
    });
  };

  const formatearDuracion = (segundos: number) => {
    const minutos = Math.floor(segundos / 60);
    const segs = segundos % 60;
    return `${minutos}:${segs.toString().padStart(2, '0')}`;
  };

  // Función para obtener metadatos completos del archivo
  const obtenerMetadatosArchivo = (archivo: File): Promise<{
    duracion: number;
    titulo?: string;
    artista?: string;
    album?: string;
    año?: number;
    genero?: string;
  }> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      const url = URL.createObjectURL(archivo);
      
      // Obtener nombre del archivo sin extensión como título por defecto
      const tituloDefault = archivo.name.replace(/\.[^/.]+$/, "");
      
      audio.addEventListener('loadedmetadata', () => {
        const duracion = Math.floor(audio.duration);
        URL.revokeObjectURL(url);
        
        // Si no se puede obtener la duración o es muy corta/larga, usar valores por defecto
        if (isNaN(duracion) || duracion < 1 || duracion > 3600) {
          resolve({
            duracion: 180, // 3 minutos por defecto
            titulo: tituloDefault
          });
        } else {
          resolve({
            duracion,
            titulo: tituloDefault
          });
        }
      });

      audio.addEventListener('error', () => {
        URL.revokeObjectURL(url);
        
        // Para archivos que no se pueden leer (como OPUS), intentar obtener duración aproximada del tamaño
        let duracionAproximada;
        
        if (archivo.name.toLowerCase().includes('.opus')) {
          // OPUS de WhatsApp suele tener bitrate de 32-48 kbps
          const bitrateBytesPerSeg = 6000; // ~48kbps
          duracionAproximada = Math.floor(archivo.size / bitrateBytesPerSeg);
        } else {
          // Para otros formatos, usar estimación general
          const tamañoKB = archivo.size / 1024;
          duracionAproximada = Math.floor(tamañoKB / 16); // 16KB por segundo para audio comprimido
        }
        
        resolve({
          duracion: Math.min(Math.max(duracionAproximada, 5), 3600), // Entre 5 segundos y 1 hora
          titulo: tituloDefault
        });
      });

      // Timeout para archivos que no cargan
      setTimeout(() => {
        URL.revokeObjectURL(url);
        
        let duracionAproximada;
        if (archivo.name.toLowerCase().includes('.opus')) {
          const bitrateBytesPerSeg = 6000; // ~48kbps para OPUS
          duracionAproximada = Math.floor(archivo.size / bitrateBytesPerSeg);
        } else {
          const tamañoKB = archivo.size / 1024;
          duracionAproximada = Math.floor(tamañoKB / 16);
        }
        
        resolve({
          duracion: Math.min(Math.max(duracionAproximada, 5), 3600),
          titulo: tituloDefault
        });
      }, 5000); // 5 segundos de timeout

      audio.src = url;
    });
  };

  // Validación de archivos de música
  const validarArchivo = (archivo: File): Promise<{ valido: boolean; error?: string; metadatos?: any }> => {
    return new Promise((resolve) => {
      // Función async interna para manejar la lógica asíncrona
      const procesarValidacion = async () => {
        // Validar tipo de archivo - incluir más formatos
        const tiposPermitidos = [
          'audio/mpeg', 
          'audio/mp3', 
          'audio/wav', 
          'audio/ogg', 
          'audio/aac',
          'audio/webm',
          'audio/mp4',
          'audio/x-m4a',
          'audio/opus'
        ];
        
        // Para archivos OPUS de WhatsApp, verificar extensión
        const esOpus = archivo.name.toLowerCase().includes('.opus') || archivo.type.includes('opus');
        
        if (!tiposPermitidos.includes(archivo.type) && !esOpus) {
          resolve({ valido: false, error: 'Formato de archivo no soportado. Use MP3, WAV, OGG, AAC, OPUS o M4A.' });
          return;
        }

        // Validar tamaño (máximo 100MB)
        const tamañoMaximo = 100 * 1024 * 1024; // 100MB
        if (archivo.size > tamañoMaximo) {
          resolve({ valido: false, error: 'El archivo es demasiado grande. Tamaño máximo: 100MB.' });
          return;
        }

        try {
          // Obtener metadatos completos
          const metadatos = await obtenerMetadatosArchivo(archivo);
          
          if (metadatos.duracion > 3600) { // 1 hora máximo
            resolve({ valido: false, error: 'La canción es demasiado larga. Duración máxima: 1 hora.' });
          } else {
            resolve({ valido: true, metadatos });
          }
        } catch (error) {
          console.error('Error procesando archivo de audio:', error);
          resolve({ valido: false, error: 'No se pudo procesar el archivo de audio.' });
        }
      };

      // Ejecutar la función asíncrona
      procesarValidacion();
    });
  };

  // Manejar selección de archivos
  const handleFileSelect = async (archivos: FileList) => {
    const archivosArray = Array.from(archivos);
    
    for (const archivo of archivosArray) {
      // Validar archivo primero
      const validacion = await validarArchivo(archivo);
      if (!validacion.valido) {
        alert(`Error en ${archivo.name}: ${validacion.error}`);
        continue;
      }

      const metadatos = validacion.metadatos;
      
      // Añadir archivo a la lista con estado de edición
      const nuevoUpload: UploadProgress = {
        fileName: archivo.name,
        progress: 0,
        status: 'editing',
        metadatos: {
          titulo: metadatos?.titulo || archivo.name.replace(/\.[^/.]+$/, ""),
          genero: metadatos?.genero || 'Sin clasificar',
          albumId: '',
          duracion: metadatos?.duracion || 180
        },
        archivo: archivo
      };
      
      setArchivosSubiendo(prev => [...prev, nuevoUpload]);
    }
  };

  // Actualizar metadatos de un archivo en edición
  const actualizarMetadatos = (fileName: string, campo: string, valor: string) => {
    setArchivosSubiendo(prev => 
      prev.map(upload => 
        upload.fileName === fileName && upload.metadatos
          ? { 
              ...upload, 
              metadatos: { 
                ...upload.metadatos, 
                [campo]: valor 
              } 
            }
          : upload
      )
    );
  };

  // Procesar archivo después de editar metadatos
  const procesarArchivo = async (upload: UploadProgress) => {
    if (!upload.archivo || !upload.metadatos) return;

    try {
      // Cambiar estado a subiendo
      setArchivosSubiendo(prev => 
        prev.map(u => 
          u.fileName === upload.fileName 
            ? { ...u, status: 'uploading', progress: 10 }
            : u
        )
      );

      // Subir archivo a Supabase Storage
      const nombreArchivo = `${Date.now()}-${upload.archivo.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      // Actualizar progreso
      setArchivosSubiendo(prev => 
        prev.map(u => 
          u.fileName === upload.fileName 
            ? { ...u, progress: 50 }
            : u
        )
      );

      const { error: uploadError } = await supabase.storage
        .from('music')
        .upload(nombreArchivo, upload.archivo, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Error de subida:', uploadError);
        let errorMessage = 'Error subiendo archivo';
        
        if (uploadError.message.includes('Bucket not found')) {
          errorMessage = 'El bucket "music" no existe. Configura Supabase Storage primero.';
        } else if (uploadError.message.includes('Policy')) {
          errorMessage = 'Sin permisos. Configura las políticas RLS del bucket.';
        } else if (uploadError.message.includes('413')) {
          errorMessage = 'Archivo demasiado grande';
        } else if (uploadError.message.includes('401')) {
          errorMessage = 'No autorizado. Verifica tu sesión.';
        }
        
        setArchivosSubiendo(prev => 
          prev.map(u => 
            u.fileName === upload.fileName 
              ? { ...u, status: 'error', error: errorMessage }
              : u
          )
        );
        return;
      }

      // Actualizar progreso
      setArchivosSubiendo(prev => 
        prev.map(u => 
          u.fileName === upload.fileName 
            ? { ...u, progress: 90 }
            : u
        )
      );

      // Obtener URL pública del archivo
      const { data: urlData } = supabase.storage
        .from('music')
        .getPublicUrl(nombreArchivo);

      // Preparar datos para la base de datos
      const datosCancion: any = {
        titulo: upload.metadatos.titulo,
        usuario_subida_id: usuario.id,
        duracion: upload.metadatos.duracion,
        genero: upload.metadatos.genero,
        año: new Date().getFullYear(),
        archivo_audio_url: urlData.publicUrl,
        reproducciones: 0,
        es_publica: true,
        estado: 'activa',
        favoritos: 0,
        descargas: 0
      };

      // Si se seleccionó un álbum, agregarlo
      if (upload.metadatos.albumId) {
        datosCancion.album_id = upload.metadatos.albumId;
      }

      // Guardar información en la base de datos
      const { error: dbError } = await supabase
        .from('canciones')
        .insert(datosCancion)
        .select()
        .single();

      if (dbError) {
        setArchivosSubiendo(prev => 
          prev.map(u => 
            u.fileName === upload.fileName 
              ? { ...u, status: 'error', error: 'Error guardando en base de datos' }
              : u
          )
        );
        return;
      }

      // Marcar como completado
      setArchivosSubiendo(prev => 
        prev.map(u => 
          u.fileName === upload.fileName 
            ? { ...u, status: 'complete', progress: 100 }
            : u
        )
      );

      // Recargar lista de canciones
      await cargarCanciones(usuario.id);

    } catch (error) {
      console.error('Error procesando archivo:', error);
      setArchivosSubiendo(prev => 
        prev.map(u => 
          u.fileName === upload.fileName 
            ? { ...u, status: 'error', error: 'Error procesando archivo' }
            : u
        )
      );
    }
  };

  // Cancelar subida de archivo
  const cancelarArchivo = (fileName: string) => {
    setArchivosSubiendo(prev => 
      prev.filter(upload => upload.fileName !== fileName)
    );
  };

  // Funciones auxiliares para manejar errores de audio
  const handleAudioPlayError = (error: any) => {
    console.error('Error reproduciendo audio:', error);
    alert('Error al reproducir la canción. Verifica que el archivo sea accesible.');
    setReproductorActual(prev => ({ ...prev, isPlaying: false }));
  };

  const handleAudioLoadError = (e: any) => {
    console.error('Error cargando audio:', e);
    const audioElement = e.target;
    let errorMsg = 'Error al cargar la canción. ';
    
    const getErrorMessage = (errorCode: number) => {
      switch(errorCode) {
        case 1: return 'Reproducción cancelada.';
        case 2: return 'Error de red al cargar el archivo.';
        case 3: return 'El archivo está dañado o en formato no válido.';
        case 4: return 'Formato de archivo no soportado.';
        default: return 'El archivo puede estar dañado o no ser accesible.';
      }
    };
    
    if (audioElement.error?.code) {
      errorMsg += getErrorMessage(audioElement.error.code);
    } else {
      errorMsg += 'El archivo puede estar dañado o no ser accesible.';
    }
    
    alert(errorMsg);
    setReproductorActual(prev => ({ ...prev, isPlaying: false }));
  };

  const handleAudioSuccess = (cancion: Cancion, audio: HTMLAudioElement) => {
    setReproductorActual({
      cancionId: cancion.id,
      isPlaying: true,
      audio: audio
    });
  };

  const handleAudioEnd = () => {
    setReproductorActual(prev => ({
      ...prev,
      isPlaying: false
    }));
  };

  // Funciones del reproductor de música
  const reproducirCancion = async (cancion: Cancion) => {
    try {
      // Si hay una canción reproduciéndose, pausarla
      if (reproductorActual.audio) {
        reproductorActual.audio.pause();
        reproductorActual.audio.currentTime = 0;
      }

      // Si es la misma canción, solo toggle play/pause
      if (reproductorActual.cancionId === cancion.id && reproductorActual.isPlaying) {
        setReproductorActual(prev => ({
          ...prev,
          isPlaying: false
        }));
        return;
      }

      // Verificar que la URL del archivo existe
      if (!cancion.archivo_audio_url) {
        alert('Esta canción no tiene un archivo de audio asociado.');
        return;
      }

      // Crear nuevo audio element
      const audio = new Audio();
      
      // Configurar eventos antes de cargar
      const handleLoadedData = () => {
        audio.play().then(() => {
          handleAudioSuccess(cancion, audio);
        }).catch(handleAudioPlayError);
      };

      audio.addEventListener('loadeddata', handleLoadedData);
      audio.addEventListener('ended', handleAudioEnd);
      audio.addEventListener('error', handleAudioLoadError);

      // Cargar el archivo
      audio.src = cancion.archivo_audio_url;
      audio.load();

    } catch (error) {
      console.error('Error general reproduciendo canción:', error);
      alert('Error inesperado al reproducir la canción.');
    }
  };

  const pausarCancion = () => {
    if (reproductorActual.audio) {
      reproductorActual.audio.pause();
      setReproductorActual(prev => ({
        ...prev,
        isPlaying: false
      }));
    }
  };

  const reanudarCancion = () => {
    if (reproductorActual.audio) {
      reproductorActual.audio.play().then(() => {
        setReproductorActual(prev => ({
          ...prev,
          isPlaying: true
        }));
      }).catch(error => {
        console.error('Error reanudando audio:', error);
      });
    }
  };

  const detenerCancion = () => {
    if (reproductorActual.audio) {
      reproductorActual.audio.pause();
      reproductorActual.audio.currentTime = 0;
      setReproductorActual({
        cancionId: '',
        isPlaying: false,
        audio: null
      });
    }
  };

  // Limpiar audio al desmontar el componente
  useEffect(() => {
    return () => {
      if (reproductorActual.audio) {
        reproductorActual.audio.pause();
        reproductorActual.audio.src = '';
      }
    };
  }, [reproductorActual.audio]);
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files?.[0]) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  // Función para corregir todas las duraciones
  const corregirTodasLasDuraciones = async () => {
    if (!usuario) return;
    
    console.log('Iniciando corrección de duraciones...');
    
    const cancionesActualizadas = await Promise.all(
      canciones.map(async (cancion) => {
        if (cancion.duracion === 180 && cancion.archivo_audio_url) {
          try {
            const duracionReal = await obtenerDuracionDesdeURL(cancion.archivo_audio_url);
            if (duracionReal && duracionReal !== 180) {
              await supabase
                .from('canciones')
                .update({ duracion: duracionReal })
                .eq('id', cancion.id);
              
              console.log(`✅ Corregida "${cancion.titulo}": ${duracionReal}s`);
              return { ...cancion, duracion: duracionReal };
            }
          } catch (error) {
            console.error(`Error corrigiendo "${cancion.titulo}":`, error);
            // Continuar con la siguiente canción sin detener el proceso
          }
        }
        return cancion;
      })
    );
    
    setCanciones(cancionesActualizadas);
    console.log('Corrección completada');
  };

  // Limpiar archivos completados
  const limpiarArchivosCompletados = () => {
    setArchivosSubiendo(prev => 
      prev.filter(upload => upload.status !== 'complete')
    );
  };

  // Función auxiliar para renderizar el botón de reproducción
  const renderBotonReproduccion = (cancion: Cancion) => {
    const esCancionActual = reproductorActual.cancionId === cancion.id;
    const estaReproduciendo = esCancionActual && reproductorActual.isPlaying;
    const estaPausada = esCancionActual && !reproductorActual.isPlaying;

    if (estaReproduciendo) {
      return (
        <button
          onClick={pausarCancion}
          className="p-2 rounded-full bg-purple-100 text-purple-600 hover:bg-purple-200 transition-colors"
          title="Pausar"
        >
          <PauseIcon className="h-4 w-4" />
        </button>
      );
    }

    if (estaPausada) {
      return (
        <button
          onClick={reanudarCancion}
          className="p-2 rounded-full bg-purple-100 text-purple-600 hover:bg-purple-200 transition-colors"
          title="Reanudar"
        >
          <PlayIcon className="h-4 w-4" />
        </button>
      );
    }

    return (
      <button
        onClick={() => reproducirCancion(cancion)}
        className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-600 transition-colors"
        title="Reproducir"
      >
        <PlayIcon className="h-4 w-4" />
      </button>
    );
  };

  // Función auxiliar para renderizar el estado de la canción
  const renderEstadoCancion = (estado: string) => {
    let clases = 'inline-flex px-2 py-1 text-xs font-medium rounded-full ';
    
    if (estado === 'activa') {
      clases += 'bg-green-100 text-green-800';
    } else if (estado === 'inactiva') {
      clases += 'bg-red-100 text-red-800';
    } else {
      clases += 'bg-yellow-100 text-yellow-800';
    }

    return (
      <span className={clases}>
        {estado}
      </span>
    );
  };

  // Función auxiliar para obtener el mensaje de progreso
  const obtenerMensajeProgreso = (progress: number) => {
    if (progress < 50) {
      return 'Validando archivo...';
    } else if (progress < 90) {
      return 'Subiendo a storage...';
    } else {
      return 'Guardando en base de datos...';
    }
  };

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  return (
    <DashboardLayout>
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <MusicalNoteIcon className="h-8 w-8 text-purple-600" />
              <h1 className="text-2xl font-bold text-gray-900">Mi Música</h1>
            </div>
            
            <button 
              onClick={async () => {
                setMostrarModalSubida(true);
                if (usuario?.id) {
                  await cargarAlbumsDisponibles(usuario.id);
                }
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Subir Nueva Canción
            </button>
          </div>
        </div>
      </div>

      {/* Mini Reproductor */}
      {reproductorActual.cancionId && (
        <div className="bg-purple-50 border-b border-purple-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  {reproductorActual.isPlaying ? (
                    <button
                      onClick={pausarCancion}
                      className="p-2 rounded-full bg-purple-600 text-white hover:bg-purple-700"
                    >
                      <PauseIcon className="h-5 w-5" />
                    </button>
                  ) : (
                    <button
                      onClick={reanudarCancion}
                      className="p-2 rounded-full bg-purple-600 text-white hover:bg-purple-700"
                    >
                      <PlayIcon className="h-5 w-5" />
                    </button>
                  )}
                  <button
                    onClick={detenerCancion}
                    className="p-2 rounded-full bg-gray-200 text-gray-600 hover:bg-red-100 hover:text-red-600"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-purple-900">
                    {canciones.find(c => c.id === reproductorActual.cancionId)?.titulo}
                  </p>
                  <p className="text-xs text-purple-600">
                    {reproductorActual.isPlaying ? '♪ Reproduciendo ahora' : 'Pausado'}
                  </p>
                </div>
              </div>
              
              <div className="text-xs text-purple-600">
                Duración: {formatearDuracion(canciones.find(c => c.id === reproductorActual.cancionId)?.duracion || 0)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contenido Principal */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          
          {/* Estadísticas Rápidas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="text-3xl mr-4">🎵</div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Canciones</p>
                  <p className="text-2xl font-bold text-gray-900">{canciones.length}</p>
                  {reproductorActual.isPlaying && (
                    <p className="text-xs text-purple-600 mt-1">♪ Reproduciendo música</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="text-3xl mr-4">▶️</div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Reproducciones</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {canciones.reduce((acc, cancion) => acc + cancion.reproducciones, 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="text-3xl mr-4">📊</div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Promedio por Canción</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {canciones.length > 0 
                      ? Math.round(canciones.reduce((acc, cancion) => acc + cancion.reproducciones, 0) / canciones.length).toLocaleString()
                      : 0
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Lista de Canciones */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Mis Canciones</h3>
                {canciones.some(c => c.duracion === 180) && (
                  <button
                    onClick={corregirTodasLasDuraciones}
                    className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200"
                  >
                    🔧 Corregir duraciones
                  </button>
                )}
              </div>
            </div>
            
            {canciones.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reproducir
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Canción
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Duración
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Género
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Año
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {canciones.map((cancion) => (
                      <tr key={cancion.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            {renderBotonReproduccion(cancion)}
                            
                            {reproductorActual.cancionId === cancion.id && (
                              <button
                                onClick={detenerCancion}
                                className="p-1 rounded text-gray-400 hover:text-red-600 transition-colors"
                                title="Detener"
                              >
                                <XMarkIcon className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className={`h-10 w-10 rounded flex items-center justify-center transition-colors ${
                                reproductorActual.cancionId === cancion.id 
                                  ? 'bg-purple-200' 
                                  : 'bg-purple-100'
                              }`}>
                                <MusicalNoteIcon className={`h-5 w-5 ${
                                  reproductorActual.cancionId === cancion.id 
                                    ? 'text-purple-700' 
                                    : 'text-purple-600'
                                }`} />
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className={`text-sm font-medium ${
                                reproductorActual.cancionId === cancion.id 
                                  ? 'text-purple-900' 
                                  : 'text-gray-900'
                              }`}>
                                {cancion.titulo}
                                {reproductorActual.cancionId === cancion.id && reproductorActual.isPlaying && (
                                  <span className="ml-2 text-xs text-purple-600">♪ Reproduciendo</span>
                                )}
                              </div>
                              <div className="text-sm text-gray-500">
                                {cancion.reproducciones.toLocaleString()} reproducciones
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatearDuracion(cancion.duracion)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {cancion.genero}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {renderEstadoCancion(cancion.estado)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {cancion.año}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button className="text-purple-600 hover:text-purple-900">
                              <ChartBarIcon className="h-4 w-4" />
                            </button>
                            <button className="text-blue-600 hover:text-blue-900">
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button className="text-red-600 hover:text-red-900">
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center">
                <MusicalNoteIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No tienes canciones</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Comienza subiendo tu primera canción.
                </p>
                <div className="mt-6">
                  <button 
                    onClick={async () => {
                      setMostrarModalSubida(true);
                      if (usuario?.id) {
                        await cargarAlbumsDisponibles(usuario.id);
                      }
                    }}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Subir Canción
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Modal de Subida de Música */}
      {mostrarModalSubida && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Subir Nueva Canción</h3>
              <button
                onClick={() => setMostrarModalSubida(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Zona de Drag & Drop */}
            <button
              type="button"
              className={`w-full border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive ? 'border-purple-400 bg-purple-50' : 'border-gray-300'
              } hover:border-purple-400 hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-500`}
              onClick={() => document.getElementById('file-input')?.click()}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600">
                Arrastra tus archivos de música aquí o haz clic para seleccionar
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Formatos soportados: MP3, WAV, OGG, AAC, OPUS, M4A (máx. 100MB)
              </p>
            </button>

            {/* Input oculto para selección de archivos */}
            <input
              id="file-input"
              type="file"
              multiple
              accept="audio/*"
              onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
              className="hidden"
            />

            {/* Lista de archivos subiendo */}
            {archivosSubiendo.length > 0 && (
              <div className="mt-6">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-medium text-gray-900">Subiendo archivos</h4>
                  <button
                    onClick={limpiarArchivosCompletados}
                    className="text-xs text-purple-600 hover:text-purple-800"
                  >
                    Limpiar completados
                  </button>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {archivosSubiendo.map((upload) => (
                    <div key={`${upload.fileName}-${upload.status}`} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {upload.fileName}
                        </span>
                        <div className="flex items-center space-x-2">
                          {upload.status === 'complete' && (
                            <CheckCircleIcon className="h-5 w-5 text-green-500" />
                          )}
                          {upload.status === 'error' && (
                            <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
                          )}
                          {upload.status === 'editing' && (
                            <button
                              onClick={() => cancelarArchivo(upload.fileName)}
                              className="text-gray-400 hover:text-red-500"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Formulario de edición de metadatos */}
                      {upload.status === 'editing' && upload.metadatos && (
                        <div className="space-y-3 bg-gray-50 p-3 rounded">
                          <div>
                            <label htmlFor={`titulo-${upload.fileName}`} className="block text-xs font-medium text-gray-700 mb-1">
                              Título de la canción
                            </label>
                            <input
                              id={`titulo-${upload.fileName}`}
                              type="text"
                              value={upload.metadatos.titulo}
                              onChange={(e) => actualizarMetadatos(upload.fileName, 'titulo', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                              placeholder="Título de la canción"
                            />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label htmlFor={`genero-${upload.fileName}`} className="block text-xs font-medium text-gray-700 mb-1">
                                Género
                              </label>
                              <select
                                id={`genero-${upload.fileName}`}
                                value={upload.metadatos.genero}
                                onChange={(e) => actualizarMetadatos(upload.fileName, 'genero', e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                              >
                                <option value="Sin clasificar">Sin clasificar</option>
                                <option value="Pop">Pop</option>
                                <option value="Rock">Rock</option>
                                <option value="Hip Hop">Hip Hop</option>
                                <option value="Electronic">Electronic</option>
                                <option value="Jazz">Jazz</option>
                                <option value="Classical">Classical</option>
                                <option value="R&B">R&B</option>
                                <option value="Country">Country</option>
                                <option value="Folk">Folk</option>
                                <option value="Reggae">Reggae</option>
                                <option value="Blues">Blues</option>
                                <option value="Otro">Otro</option>
                              </select>
                            </div>
                            
                            <div>
                              <label htmlFor={`album-${upload.fileName}`} className="block text-xs font-medium text-gray-700 mb-1">
                                Álbum (opcional)
                              </label>
                              <select
                                id={`album-${upload.fileName}`}
                                value={upload.metadatos.albumId || ''}
                                onChange={(e) => actualizarMetadatos(upload.fileName, 'albumId', e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                              >
                                <option value="">Sin álbum</option>
                                {albumsDisponibles.map((album) => (
                                  <option key={album.id} value={album.id}>
                                    {album.titulo}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          
                          <div className="flex justify-end space-x-2 pt-2">
                            <button
                              onClick={() => cancelarArchivo(upload.fileName)}
                              className="px-3 py-1 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => procesarArchivo(upload)}
                              disabled={!upload.metadatos.titulo.trim()}
                              className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                            >
                              Subir Canción
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {upload.status === 'uploading' && (
                        <>
                          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                            <div 
                              className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${upload.progress}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-500">
                            {obtenerMensajeProgreso(upload.progress)}
                          </p>
                        </>
                      )}
                      
                      {upload.status === 'complete' && (
                        <p className="text-xs text-green-600 mt-1">
                          ✅ Archivo subido correctamente
                        </p>
                      )}
                      
                      {upload.status === 'error' && upload.error && (
                        <p className="text-xs text-red-600 mt-1">{upload.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Información sobre Supabase Storage */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 mb-2">⚠️ Configuración requerida para Supabase Storage:</h4>
              <div className="text-xs text-blue-700 space-y-1">
                <p><strong>1. Crear bucket:</strong> Ve a tu dashboard de Supabase → Storage → Create bucket → nombre: "music"</p>
                <p><strong>2. Configurar políticas RLS:</strong></p>
                <div className="ml-4 bg-blue-100 p-2 rounded text-xs font-mono">
                  <p>-- Política para subir archivos (artistas)</p>
                  <p>CREATE POLICY "Artistas pueden subir música" ON storage.objects</p>
                  <p>FOR INSERT WITH CHECK (bucket_id = 'music' AND auth.uid() = owner);</p>
                </div>
                <p><strong>3. Hacer bucket público:</strong> Settings → Make bucket public</p>
                <p className="text-red-600">⚠️ Sin esta configuración, las subidas fallarán con error 400</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}