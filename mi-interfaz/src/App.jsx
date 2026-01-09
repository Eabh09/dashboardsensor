import React, { useState, useEffect, useRef } from 'react';

const SensorDashboard = () => {
  const [datos, setDatos] = useState(null);
  const [status, setStatus] = useState("Desconectado");
  const [historial, setHistorial] = useState([]);
  const [serverIP, setServerIP] = useState("192.168.1.100");
  const [port, setPort] = useState("8080");
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const mapViewRef = useRef(null);
  const graphicsLayerRef = useRef(null);

  const MAX_POINTS = 50;

  // Función para crear gráfico SVG de línea
  const createJerkChart = () => {
    if (historial.length < 2) return null;

    const width = 100;
    const height = 100;
    const padding = 5;
    const maxJerk = Math.max(...historial.map(d => d.jerk), 2);
    
    const points = historial.map((d, i) => {
      const x = (i / (historial.length - 1)) * (width - padding * 2) + padding;
      const y = height - ((d.jerk / maxJerk) * (height - padding * 2) + padding);
      return `${x},${y}`;
    }).join(' L ');

    return (
      <svg viewBox={`0 0 ${width} ${height}`} style={{width: '100%', height: '120px'}}>
        <defs>
          <linearGradient id="jerkGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#00d4ff" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        
        {/* Grid lines */}
        <line x1={padding} y1="25" x2={width - padding} y2="25" stroke="#2a2a3e" strokeWidth="0.5" />
        <line x1={padding} y1="50" x2={width - padding} y2="50" stroke="#2a2a3e" strokeWidth="0.5" />
        <line x1={padding} y1="75" x2={width - padding} y2="75" stroke="#2a2a3e" strokeWidth="0.5" />
        
        {/* Area bajo la línea */}
        <path 
          d={`M ${points} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`} 
          fill="url(#jerkGradient)" 
        />
        
        {/* Línea principal */}
        <path 
          d={`M ${points}`} 
          fill="none" 
          stroke="#00d4ff" 
          strokeWidth="2.5" 
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Punto actual */}
        <circle 
          cx={width - padding} 
          cy={height - ((historial[historial.length - 1].jerk / maxJerk) * (height - padding * 2) + padding)} 
          r="3" 
          fill="#00d4ff"
          stroke="#fff"
          strokeWidth="1.5"
        />
      </svg>
    );
  };

  // Inicializar ArcGIS Map
  useEffect(() => {
    if (!datos) return;

    const initMap = async () => {
      try {
        // Cargar CSS de ArcGIS
        if (!document.getElementById('arcgis-css')) {
          const link = document.createElement('link');
          link.id = 'arcgis-css';
          link.rel = 'stylesheet';
          link.href = 'https://js.arcgis.com/4.28/esri/themes/dark/main.css';
          document.head.appendChild(link);
        }

        // Cargar módulos de ArcGIS
        if (!window.require) {
          const script = document.createElement('script');
          script.src = 'https://js.arcgis.com/4.28/';
          script.onload = () => loadMap();
          document.head.appendChild(script);
        } else {
          loadMap();
        }

        function loadMap() {
          window.require([
            "esri/Map",
            "esri/views/MapView",
            "esri/Graphic",
            "esri/layers/GraphicsLayer"
          ], (Map, MapView, Graphic, GraphicsLayer) => {
            
            if (mapViewRef.current) return;

            const graphicsLayer = new GraphicsLayer();
            graphicsLayerRef.current = graphicsLayer;

            const map = new Map({
              basemap: "dark-gray-vector",
              layers: [graphicsLayer]
            });

            const view = new MapView({
              container: "mapDiv",
              map: map,
              center: [parseFloat(datos.lon) || -79.5335, parseFloat(datos.lat) || 9.0765],
              zoom: 15,
              ui: {
                components: ["zoom"]
              }
            });

            mapViewRef.current = view;

            // Crear marcador inicial
            const point = {
              type: "point",
              longitude: parseFloat(datos.lon) || -79.5335,
              latitude: parseFloat(datos.lat) || 9.0765
            };

            const markerSymbol = {
              type: "simple-marker",
              color: [0, 212, 255],
              size: "12px",
              outline: {
                color: [255, 255, 255],
                width: 2
              }
            };

            const pointGraphic = new Graphic({
              geometry: point,
              symbol: markerSymbol
            });

            graphicsLayer.add(pointGraphic);
          });
        }
      } catch (error) {
        console.error("Error inicializando mapa ArcGIS:", error);
      }
    };

    initMap();
  }, [datos]);

  // Actualizar marcador en tiempo real
  useEffect(() => {
    if (!datos || !mapViewRef.current || !graphicsLayerRef.current) return;

    try {
      const lat = parseFloat(datos.lat);
      const lon = parseFloat(datos.lon);

      if (isNaN(lat) || isNaN(lon)) return;

      window.require([
        "esri/Graphic"
      ], (Graphic) => {
        // Limpiar marcador anterior
        graphicsLayerRef.current.removeAll();

        // Crear nuevo marcador
        const point = {
          type: "point",
          longitude: lon,
          latitude: lat
        };

        const markerSymbol = {
          type: "simple-marker",
          color: [0, 212, 255],
          size: "12px",
          outline: {
            color: [255, 255, 255],
            width: 2
          }
        };

        const pointGraphic = new Graphic({
          geometry: point,
          symbol: markerSymbol
        });

        graphicsLayerRef.current.add(pointGraphic);

        // Centrar mapa en nueva posición
        mapViewRef.current.center = [lon, lat];
      });
    } catch (error) {
      console.error("Error actualizando marcador:", error);
    }
  }, [datos?.lat, datos?.lon]);

  useEffect(() => {
    if (!isConnected) return;

    let ws;
    try {
      ws = new WebSocket(`ws://${serverIP}:${port}`);

      ws.onopen = () => {
        console.log("✓ WebSocket conectado");
        setStatus("CONECTADO");
      };
      
      ws.onmessage = (event) => {
        try {
          const dataParsed = JSON.parse(event.data);
          console.log("✓ Datos recibidos:", dataParsed);
          setDatos(dataParsed);
          
          const newData = {
            jerk: parseFloat(dataParsed.jerkMagnitude) || 0,
            temp: parseFloat(dataParsed.temp) || 0,
            hum: parseFloat(dataParsed.hum) || 0
          };
          
          setHistorial(prev => [...prev, newData].slice(-MAX_POINTS));
        } catch (error) {
          console.error("✗ Error parseando datos:", error);
        }
      };
      
      ws.onerror = (error) => {
        console.error("✗ Error WebSocket:", error);
        setStatus("ERROR");
      };
      
      ws.onclose = () => {
        console.log("✗ WebSocket desconectado");
        setStatus("DESCONECTADO");
        setIsConnected(false);
      };
      
      return () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    } catch (error) {
      console.error("✗ Error creando WebSocket:", error);
      setStatus("ERROR");
    }
  }, [isConnected, serverIP, port]);

  const handleConnect = () => {
    console.log("Intentando conectar a:", `ws://${serverIP}:${port}`);
    setIsConnected(true);
    setIsConfigOpen(false);
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setDatos(null);
    setHistorial([]);
    setStatus("DESCONECTADO");
  };

  const getStatusColor = () => {
    if (status === "CONECTADO") return '#00ff41';
    if (status === "ERROR") return '#ff3860';
    return '#666';
  };

  return (
    <div style={styles.container}>
      {/* Top Bar */}
      <div style={styles.topBar}>
        <div style={styles.navTabs}>
          <div style={styles.activeTab}>Dashboard</div>
          <div style={styles.tab}>Overview</div>
          <div style={styles.tab}>Sensors</div>
          <div style={styles.tab}>Config</div>
        </div>
        <div style={styles.topBarRight}>
          <button onClick={() => setIsConfigOpen(!isConfigOpen)} style={styles.iconButton}>⚙️</button>
          {isConnected && (
            <button onClick={handleDisconnect} style={{...styles.iconButton, color: '#ff3860'}}>●</button>
          )}
          <div style={{...styles.statusIndicator, color: getStatusColor()}}>
            ● {status}
          </div>
        </div>
      </div>

      {/* Config Modal */}
      {isConfigOpen && (
        <div style={styles.configModal} onClick={() => setIsConfigOpen(false)}>
          <div style={styles.configContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.configTitle}>⚙️ Configuración de Conexión</h3>
            <div style={styles.configForm}>
              <label style={styles.label}>IP del Servidor</label>
              <input 
                type="text" 
                value={serverIP} 
                onChange={(e) => setServerIP(e.target.value)}
                style={styles.input}
                disabled={isConnected}
              />
              <label style={styles.label}>Puerto</label>
              <input 
                type="text" 
                value={port} 
                onChange={(e) => setPort(e.target.value)}
                style={styles.input}
                disabled={isConnected}
              />
              <button onClick={handleConnect} style={styles.connectBtn} disabled={isConnected}>
                {isConnected ? '✓ Conectado' : 'Conectar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!datos ? (
        <div style={styles.loading}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>
            {isConnected ? 'Esperando datos del servidor...' : 'No conectado'}
          </p>
          {!isConnected && (
            <button onClick={() => setIsConfigOpen(true)} style={styles.setupBtn}>
              Configurar Conexión
            </button>
          )}
        </div>
      ) : (
        <div style={styles.content}>
          {/* Main Grid */}
          <div style={styles.mainGrid}>
            {/* Left Panel - Table */}
            <div style={styles.panel}>
              <div style={styles.panelHeader}>● Resumen de Sensores</div>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Sensor</th>
                    <th style={styles.th}>Valor</th>
                    <th style={styles.th}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={styles.tr}>
                    <td style={styles.td}>Temperatura</td>
                    <td style={styles.tdValue}>{datos.temp}°C</td>
                    <td style={styles.tdStatus}><span style={{color: '#00ff41'}}>●</span></td>
                  </tr>
                  <tr style={styles.tr}>
                    <td style={styles.td}>Humedad</td>
                    <td style={styles.tdValue}>{datos.hum}%</td>
                    <td style={styles.tdStatus}><span style={{color: '#00ff41'}}>●</span></td>
                  </tr>
                  <tr style={styles.tr}>
                    <td style={styles.td}>Magnitud Jerk</td>
                    <td style={styles.tdValue}>{datos.jerkMagnitude}</td>
                    <td style={styles.tdStatus}><span style={{color: '#00d4ff'}}>●</span></td>
                  </tr>
                  <tr style={styles.tr}>
                    <td style={styles.td}>Estado</td>
                    <td style={styles.tdValue}>{datos.state || 'N/A'}</td>
                    <td style={styles.tdStatus}>
                      <span style={{color: datos.state === 'cerrado' ? '#ff3860' : '#00ff41'}}>●</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Right Panel - Metrics */}
            <div style={styles.rightPanel}>
              {/* Gauges */}
              <div style={styles.gaugesPanel}>
                <div style={styles.gaugeBox}>
                  <div style={styles.gaugeValue}>{datos.temp}°C</div>
                  <div style={styles.gaugeLabel}>TEMPERATURA</div>
                  <div style={styles.progressBar}>
                    <div style={{...styles.progressFill, width: `${Math.min((datos.temp / 50) * 100, 100)}%`, backgroundColor: '#ff9500'}}></div>
                  </div>
                </div>
                <div style={styles.gaugeBox}>
                  <div style={styles.gaugeValue}>{datos.hum}%</div>
                  <div style={styles.gaugeLabel}>HUMEDAD</div>
                  <div style={styles.progressBar}>
                    <div style={{...styles.progressFill, width: `${Math.min(datos.hum, 100)}%`, backgroundColor: '#00d4ff'}}></div>
                  </div>
                </div>
              </div>

              {/* Data Points */}
              <div style={styles.dataPanel}>
                <div style={styles.panelHeader}>📊 Magnitud Jerk - {historial.length} puntos</div>
                <div style={styles.jerkDisplay}>
                  <div style={styles.jerkBox}>
                    <div style={styles.jerkLabel}>MAGNITUD JERK</div>
                    <div style={styles.jerkValue}>{datos.jerkMagnitude}</div>
                    <div style={styles.jerkBar}>
                      <div style={{
                        ...styles.jerkBarFill, 
                        width: `${Math.min((parseFloat(datos.jerkMagnitude) / 2) * 100, 100)}%`,
                        backgroundColor: parseFloat(datos.jerkMagnitude) > 1 ? '#ff3860' : '#00d4ff'
                      }}></div>
                    </div>
                    <div style={styles.jerkInfo}>
                      {parseFloat(datos.jerkMagnitude) > 1 ? '⚠️ Movimiento Alto' : '✓ Normal'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Gráfico de Jerk */}
              {historial.length >= 2 && (
                <div style={styles.chartPanel}>
                  <div style={styles.panelHeader}>📈 Historial de Jerk (últimos {historial.length} puntos)</div>
                  <div style={styles.chartContainer}>
                    {createJerkChart()}
                  </div>
                  <div style={styles.chartStats}>
                    <div style={styles.statItem}>
                      <span style={styles.statLabel}>Actual:</span>
                      <span style={styles.statValue}>{datos.jerkMagnitude}</span>
                    </div>
                    <div style={styles.statItem}>
                      <span style={styles.statLabel}>Máximo:</span>
                      <span style={styles.statValue}>
                        {Math.max(...historial.map(d => d.jerk)).toFixed(2)}
                      </span>
                    </div>
                    <div style={styles.statItem}>
                      <span style={styles.statLabel}>Promedio:</span>
                      <span style={styles.statValue}>
                        {(historial.reduce((sum, d) => sum + d.jerk, 0) / historial.length).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Map Panel */}
          <div style={styles.mapPanel}>
            <div style={styles.mapHeader}>
              <span style={styles.mapTitle}>📍 UBICACIÓN GPS - TIEMPO REAL</span>
              <span style={styles.coords}>LAT: {datos.lat} | LON: {datos.lon}</span>
            </div>
            <div id="mapDiv" style={styles.mapContainer}></div>
          </div>

          {/* Footer */}
          <div style={styles.footer}>
            ws://{serverIP}:{port} | {new Date().toLocaleTimeString()} | Puntos: {historial.length}
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: '#0a0a0f',
    minHeight: '100vh',
    color: '#fff',
    fontFamily: 'Consolas, Monaco, monospace',
    fontSize: '13px'
  },
  topBar: {
    backgroundColor: '#16161f',
    borderBottom: '1px solid #2a2a3e',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  navTabs: {
    display: 'flex'
  },
  activeTab: {
    padding: '12px 20px',
    backgroundColor: '#1e3a5f',
    color: '#fff',
    fontWeight: 'bold',
    borderBottom: '2px solid #00d4ff'
  },
  tab: {
    padding: '12px 20px',
    color: '#888',
    cursor: 'pointer'
  },
  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    padding: '0 20px'
  },
  iconButton: {
    background: 'none',
    border: 'none',
    color: '#888',
    fontSize: '16px',
    cursor: 'pointer'
  },
  statusIndicator: {
    fontSize: '12px',
    fontWeight: 'bold'
  },
  content: {
    padding: '15px'
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '400px 1fr',
    gap: '15px',
    marginBottom: '15px'
  },
  panel: {
    backgroundColor: '#16161f',
    border: '1px solid #2a2a3e',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  panelHeader: {
    padding: '12px 15px',
    backgroundColor: '#1a1a2e',
    borderBottom: '1px solid #2a2a3e',
    fontWeight: 'bold',
    color: '#00d4ff'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    padding: '10px',
    textAlign: 'left',
    backgroundColor: '#1a1a2e',
    color: '#888',
    fontSize: '11px',
    textTransform: 'uppercase',
    borderBottom: '1px solid #2a2a3e'
  },
  tr: {
    borderBottom: '1px solid #2a2a3e'
  },
  td: {
    padding: '10px',
    color: '#ccc'
  },
  tdValue: {
    padding: '10px',
    color: '#fff',
    fontWeight: 'bold',
    fontFamily: 'monospace'
  },
  tdStatus: {
    padding: '10px',
    textAlign: 'center',
    fontSize: '16px'
  },
  rightPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  gaugesPanel: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '15px'
  },
  gaugeBox: {
    backgroundColor: '#16161f',
    border: '1px solid #2a2a3e',
    borderRadius: '4px',
    padding: '20px',
    textAlign: 'center'
  },
  gaugeValue: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: '10px'
  },
  gaugeLabel: {
    fontSize: '11px',
    color: '#888',
    marginBottom: '15px',
    letterSpacing: '1px'
  },
  progressBar: {
    height: '8px',
    backgroundColor: '#1a1a2e',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    transition: 'width 0.3s'
  },
  dataPanel: {
    backgroundColor: '#16161f',
    border: '1px solid #2a2a3e',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  jerkDisplay: {
    padding: '30px',
    display: 'flex',
    justifyContent: 'center'
  },
  jerkBox: {
    width: '100%',
    maxWidth: '400px',
    textAlign: 'center'
  },
  jerkLabel: {
    fontSize: '11px',
    color: '#888',
    marginBottom: '15px',
    letterSpacing: '2px',
    fontWeight: 'bold'
  },
  jerkValue: {
    fontSize: '3.5rem',
    fontWeight: 'bold',
    color: '#00d4ff',
    marginBottom: '20px',
    textShadow: '0 0 20px rgba(0, 212, 255, 0.5)'
  },
  jerkBar: {
    height: '20px',
    backgroundColor: '#1a1a2e',
    borderRadius: '10px',
    overflow: 'hidden',
    marginBottom: '15px'
  },
  jerkBarFill: {
    height: '100%',
    transition: 'width 0.3s, background-color 0.3s',
    borderRadius: '10px'
  },
  jerkInfo: {
    fontSize: '0.95rem',
    color: '#ccc',
    fontWeight: 'bold'
  },
  chartPanel: {
    backgroundColor: '#16161f',
    border: '1px solid #2a2a3e',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  chartContainer: {
    padding: '20px',
    backgroundColor: '#1a1a2e'
  },
  chartStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '15px',
    padding: '15px',
    borderTop: '1px solid #2a2a3e'
  },
  statItem: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px'
  },
  statLabel: {
    fontSize: '0.8rem',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  statValue: {
    fontSize: '1.3rem',
    color: '#00d4ff',
    fontWeight: 'bold',
    fontFamily: 'monospace'
  },
  mapPanel: {
    backgroundColor: '#16161f',
    border: '1px solid #2a2a3e',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '15px'
  },
  mapHeader: {
    padding: '12px 15px',
    backgroundColor: '#1a1a2e',
    borderBottom: '1px solid #2a2a3e',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  mapTitle: {
    color: '#00ff41',
    fontWeight: 'bold'
  },
  coords: {
    color: '#888',
    fontSize: '11px'
  },
  mapContainer: {
    height: '350px',
    backgroundColor: '#1a1a2e',
    position: 'relative',
    width: '100%'
  },
  footer: {
    textAlign: 'center',
    padding: '15px',
    color: '#555',
    fontSize: '11px',
    borderTop: '1px solid #2a2a3e'
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '80vh',
    gap: '20px'
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '3px solid #2a2a3e',
    borderTop: '3px solid #00d4ff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  loadingText: {
    color: '#888'
  },
  setupBtn: {
    padding: '12px 30px',
    backgroundColor: '#1e3a5f',
    color: '#fff',
    border: '1px solid #00d4ff',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: 'inherit'
  },
  configModal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  configContent: {
    backgroundColor: '#16161f',
    border: '1px solid #2a2a3e',
    borderRadius: '4px',
    padding: '30px',
    minWidth: '400px'
  },
  configTitle: {
    color: '#00d4ff',
    marginBottom: '20px'
  },
  configForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  label: {
    color: '#888',
    fontSize: '12px'
  },
  input: {
    padding: '10px',
    backgroundColor: '#1a1a2e',
    border: '1px solid #2a2a3e',
    borderRadius: '4px',
    color: '#fff',
    fontFamily: 'inherit'
  },
  connectBtn: {
    padding: '12px',
    backgroundColor: '#1e3a5f',
    color: '#fff',
    border: '1px solid #00d4ff',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: '10px'
  }
};

const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(1.1); }
  }
`;
document.head.appendChild(styleSheet);

export default SensorDashboard;