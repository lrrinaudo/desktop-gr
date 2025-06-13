import { useState, useEffect } from 'react'
import { ClipLoader } from 'react-spinners'
import {
	LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea
} from 'recharts'

function App() {

	// Estado para controlar pantalla: 'main' o 'history'
	const [page, setPage] = useState<'main' | 'history' | 'login'>('main')

	const [username, setUsername] = useState('')
	const [password, setPassword] = useState('')
	const [error, setError] = useState('')
	const [glucose, setGlucose] = useState<any>(null)
	const [history, setHistory] = useState<any[]>([])

	const [hovered, setHovered] = useState(false)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		const loadSavedCredentials = async () => {
			try {
				const creds = await window.electron.invoke('get-credentials')
				if (creds?.username && creds?.password) {
					setUsername(creds.username)
					setPassword(creds.password)
					await fetchGlucose(creds.username, creds.password)
					changeWindow('main')
				} else {
					setLoading(false) // mostrar login si no hay credenciales
				}
			} catch (err) {
				console.error('Error al cargar credenciales:', err)
				setLoading(false)
			} finally {
				setLoading(false)
			}
		}

		loadSavedCredentials()
	}, [])

	// Ejecutar fetchGlucose cada 1 minuto si hay datos de glucosa (ya logueado)
	useEffect(() => {
		if (!glucose) return // no iniciar intervalo si no hay glucosa (login pendiente)

		const intervalId = setInterval(() => {
			fetchGlucose(username, password)
		}, 90 * 1000) // 90 segundos

		return () => clearInterval(intervalId) // limpiar al desmontar
	}, [glucose, username, password])

	const fetchGlucose = async (user: string, pass: string) => {
		try {
			setError('')
			// setLoading(true)
			const response = await window.electron.invoke('get-glucose', {
				username: user,
				password: pass,
			})

			if (response.status != 'ok') {
				throw response
			}
			setGlucose(response.data.current)
			setHistory(response.data.history || []) // Guardamos el historial
			return true
		} catch (err: any) {
			// console.error(err)
			// setError('Credenciales inválidas o error de conexión.')
			// return false
			if (err.status === 'auth_error') {
				setError('Credenciales inválidas o error de conexión.')
			} else {
				setError('Error')
			}
			return false

		} finally {
			// setLoading(false)
		}
	}


	const handleLogin = async () => {
		setLoading(true)
		const success = await fetchGlucose(username, password)
		if (success) {
			await window.electron.invoke('save-credentials', { username, password }) // 🔁 esto falta
			changeWindow('main')
		}
		setLoading(false)
	}

	const handleLogout = async () => {
		await window.electron.invoke('clear-credentials')
		setUsername('')
		setPassword('')
		setGlucose(null)
		setHistory([])
		changeWindow('login')
	}

	const formatDate = (ts: string) => {
		const d = new Date(ts)
		const hours = d.getHours().toString().padStart(2, '0')
		const minutes = d.getMinutes().toString().padStart(2, '0')
		return `${hours}:${minutes}`
	}

	const CustomTooltip = ({ active, payload }: any) => {
		if (active && payload && payload.length) {
			const data = payload[0].payload;

			return (
				<div
					style={{
						background: '#1f2937',
						color: '#f9fafb',
						border: '1px solid #ccc',
						padding: '10px',
						borderRadius: '8px',
						fontSize: '14px',
					}}
				>
					<p><strong>Valor:</strong> {data.value} mg/dL</p>
					<p><strong>Hora:</strong> {data.timestamp}</p>
				</div>
			);
		}

		return null;
	};

	const changeWindow = (page: 'main' | 'history' | 'login') => {
		window.electron.send('set-window', page)
		setPage(page)
	}

	const trendToArrow = (trend: string) => {
		switch (trend) {
			case 'SingleUp':
				return '⬆'
			case 'FortyFiveUp':
				return '↗'
			case 'Flat':
				return '➡'
			case 'FortyFiveDown':
				return '↘'
			case 'SingleDown':
				return '⬇'
			case 'NotComputable':
			default:
				return '⏺ Sin datos'
		}
	}

	function getColorByGlucoseValue(value: number): string {
		if (value > 240) return '#E86D0E';
		if (value > 180) return '#FFBC01';
		if (value >= 70) return 'white';
		// if (value >= 70) return '#90CB3D';
		return '#ED1C26';
	}

	const handleExit = () => {
		window.close()
	}

	if (loading) {
		return (
			<div style={styles.page}>
				<div
					style={{
						...styles.card,
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
					}}
				>
					<ClipLoader color="#3B82F6" size={40} />
					<h2 style={{ ...styles.title, marginTop: '16px' }}>Cargando...</h2>
				</div>
			</div>
		)
	}

	if (glucose && page === 'main') {

		return (
			<div
				style={{
					backgroundColor: 'black',
					color: 'white',
					WebkitAppRegion: 'drag',
					width: '100vw',
					height: '100vh',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					gap: '2px', // esto da un poco de separación entre valor y botón
					padding: '1px',
					boxSizing: 'border-box',
					overflow: 'hidden',
				} as any}
			>
				<p style={{ margin: 0 }}>
					{error ?
						<>
							<strong style={{ color: '#ED1C26', fontSize: 12 }}>  Error</strong>
						</>
						:
						<>
							{/* <strong style={{fontSize: 12}}>mg/dL:</strong><strong style={{ color: getColorByGlucoseValue(glucose.value), fontSize: 12 }}> {glucose.value} </strong> {trendToArrow(glucose.trend)} */}
							<strong style={{ color: getColorByGlucoseValue(glucose.value), fontSize: 18 }}> {glucose.value} </strong> {trendToArrow(glucose.trend)}
						</>
					}
				</p>
				<button
					onClick={() => changeWindow('history')}
					style={{
						...styles.buttonHistory,
						WebkitAppRegion: 'no-drag', // importante para que el botón sea clickeable
					} as any}
				>
					Historial
				</button>
			</div>
		)
	}

	if (page === 'history') {
		return (
			<div style={styles.page}>
				<div style={{ ...styles.card, maxWidth: '800px' }}>
					<h2 style={styles.title}>Historial de Glucosa</h2>
					{history.length === 0 ? (
						<p>No hay datos de historial para mostrar.</p>
					) : (
						<ResponsiveContainer width="100%" height={300} style={{ WebkitAppRegion: 'no-drag' } as any}>
							<LineChart data={history.map((h) => ({
								timestamp: formatDate(h.date),
								value: h.value,
							}))}
								margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
								<XAxis dataKey="timestamp" />
								<YAxis domain={[40, 300]} />
								{/* <Tooltip labelFormatter={formatDate} /> */}
								<Tooltip content={<CustomTooltip />} />
								<CartesianGrid stroke="#ccc" strokeDasharray="5 5" />

								{/* Área verde claro entre 70 y 180 */}
								<ReferenceArea
									y1={70}
									y2={180}
									fill="#d1fae5" // verde claro (Tailwind green-100)
									fillOpacity={0.4}
								/>

								<Line
									type="monotone"
									dataKey="value"
									stroke="#3B82F6"
									strokeWidth={3}
									dot={false}
								/>
							</LineChart>

						</ResponsiveContainer>
					)}
					<button onClick={() => changeWindow('main')} style={{ ...styles.button, marginTop: '24px', backgroundColor: '#10B981' }}>
						Volver
					</button>
					<button onClick={handleLogout} style={{ ...styles.button, marginTop: '24px' }}>
						Cerrar sesión
					</button>
					<button onClick={handleExit} style={{ ...styles.button, marginTop: '24px', backgroundColor: '#ED1C26' }}>
						Salir
					</button>
				</div>
			</div>
		)
	}

	return (
		<div style={styles.page}>
			<h1 style={styles.loginTitle}>Glucose Read</h1>
			<div style={{ ...styles.card, WebkitAppRegion: 'no-drag' } as any}>
				<h2 style={styles.title}>Iniciar sesión</h2>
				<div
					style={styles.form}
					onKeyDown={(e) => {
						if (e.key === 'Enter') {
							handleLogin()
						}
					}}
				>
					<input
						type="email"
						placeholder={"Correo electrónico"}
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						style={styles.input}
					/>
					<input
						type="password"
						placeholder={"Contraseña"}
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						style={styles.input}
					/>
					<button
						onClick={handleLogin}
						onMouseEnter={() => setHovered(true)}
						onMouseLeave={() => setHovered(false)}
						style={{
							...styles.button,
							...(hovered ? styles.buttonHover : {}),
						}}
					>
						Iniciar sesión
					</button>
					{error && <p style={styles.error}>{error}</p>}
				</div>
			</div>
		</div>
	)
}

const styles: { [key: string]: React.CSSProperties } = {
	page: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: '100vw',
		height: '100vh',
		background: '#f3f4f6',
		padding: '16px',
		boxSizing: 'border-box',
		overflow: 'hidden',
		fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
		WebkitAppRegion: 'drag',
		flexDirection: 'column'
	} as any,
	card: {
		background: '#fff',
		padding: '40px',
		borderRadius: '16px',
		boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
		width: '100%',
		maxWidth: '400px',
		boxSizing: 'border-box',
	},
	title: {
		fontSize: '24px',
		fontWeight: 'bold',
		marginBottom: '24px',
		color: '#333',
		textAlign: 'center',
	},
	form: {
		display: 'flex',
		flexDirection: 'column',
		gap: '16px',
	},
	input: {
		width: '100%',
		padding: '12px 14px',
		marginBottom: '16px',
		borderRadius: '8px',
		border: '1px solid #ccc',
		fontSize: '15px',
		backgroundColor: '#fff',
		color: '#333',
		boxSizing: 'border-box',
		boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
	},
	button: {
		width: '100%',
		padding: '12px',
		border: 'none',
		borderRadius: '8px',
		backgroundColor: '#3B82F6', // azul suave (Tailwind Blue-500)
		color: '#fff',
		fontSize: '16px',
		cursor: 'pointer',
		transition: 'background 0.3s ease',
		WebkitAppRegion: 'no-drag',
	} as any,
	buttonHistory: {
		width: '100%',
		padding: '2px',
		border: 'none',
		borderRadius: '8px',
		backgroundColor: '#3B82F6', // azul suave (Tailwind Blue-500)
		color: '#fff',
		fontSize: 10,
		cursor: 'pointer',
		transition: 'background 0.3s ease',
		WebkitAppRegion: 'no-drag',
	} as any,
	error: {
		color: '#ef4444',
		marginTop: '8px',
		textAlign: 'center',
		fontSize: '14px',
	},
	glucoseBox: {
		backgroundColor: '#f9fafb',
		padding: '16px',
		borderRadius: '12px',
		lineHeight: '1.6',
		color: '#1f2937',
	},
	buttonHover: {
		backgroundColor: '#2563EB', // azul más oscuro al pasar el mouse
	},
	loginTitle: {
		fontSize: '32px',
		fontWeight: 'bold',
		textAlign: 'center',
		color: '#10B981', // verde esmeralda (Tailwind emerald-500)
		marginBottom: 25,
		fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
	},
	// buttonExit: {
	// 	marginTop: 20,
	// 	padding: '6px 12px',
	// 	borderRadius: 4,
	// 	backgroundColor: '#ED1C26',
	// 	color: 'white',
	// 	border: 'none',
	// 	cursor: 'pointer',
	// },
}

export default App