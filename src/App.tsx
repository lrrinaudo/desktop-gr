import { useState, useEffect, useRef } from 'react'
import { ClipLoader } from 'react-spinners'
import {
	LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea
} from 'recharts'
import logo from './assets/llu.png'

function App() {

	// Estado para controlar pantalla: 'main' o 'history'
	const [page, setPage] = useState<'main' | 'history' | 'login'>('login')

	// Version actual el 09/10/2025 5.3.0
	const [version, setVersion] = useState('5.3.0')

	const [username, setUsername] = useState('')
	const [password, setPassword] = useState('')
	const [error, setError] = useState('')
	const [glucose, setGlucose] = useState<any>(null)
	const [history, setHistory] = useState<any[]>([])

	const [hovered, setHovered] = useState(false)
	const [historyHoveredButton, setHistoryHoveredButton] = useState<'back' | 'logout' | 'exit' | null>(null)
	const [loading, setLoading] = useState(true)
	const [windowSize, setWindowSize] = useState({
		width: window.innerWidth,
		height: window.innerHeight,
	})
	const mainInteractionRef = useRef({
		pointerDown: false,
		dragging: false,
		startScreenX: 0,
		startScreenY: 0,
		offsetX: 0,
		offsetY: 0,
	})

	useEffect(() => {
		const loadSavedCredentials = async () => {
			try {
				changeWindow('login') // aseguramos que al arrancar esté en tamaño login
				const creds = await window.electron.invoke('get-credentials')
				if (creds?.username && creds?.password) {
					setUsername(creds.username)
					setPassword(creds.password)
					if (creds.version) setVersion(creds.version)

					const success = await fetchGlucose(creds.username, creds.password, creds.version || '5.3.0')
					if (success) {
						changeWindow('main') // solo si login OK
					} else {
						changeWindow('login') // si falla, volvemos a login
					}
				} else {
					setLoading(false) // mostrar login si no hay credenciales
				}
			} catch (err) {
				console.error('Error loading credentials:', err)
				changeWindow('login')
			} finally {
				setLoading(false)
			}
		}

		loadSavedCredentials()
	}, [])

	useEffect(() => {
		if (loading) {
			window.electron.send('set-window', 'loading')
		}
	}, [loading])

	useEffect(() => {
		const handleResize = () => {
			setWindowSize({ width: window.innerWidth, height: window.innerHeight })
		}

		window.addEventListener('resize', handleResize)
		return () => window.removeEventListener('resize', handleResize)
	}, [])

	useEffect(() => {
		const handleWindowMouseMove = (e: MouseEvent) => {
			const state = mainInteractionRef.current
			if (!state.pointerDown) return

			const deltaX = e.screenX - state.startScreenX
			const deltaY = e.screenY - state.startScreenY
			if (!state.dragging && Math.hypot(deltaX, deltaY) >= mainDragThreshold) {
				state.dragging = true
			}

			if (!state.dragging) return

			window.electron.send('set-window-position', {
				x: Math.round(e.screenX - state.offsetX),
				y: Math.round(e.screenY - state.offsetY),
			})
		}

		const handleWindowMouseUp = () => {
			const state = mainInteractionRef.current
			if (!state.pointerDown) return

			const shouldNavigateToHistory = page === 'main' && !state.dragging
			state.pointerDown = false
			state.dragging = false

			if (shouldNavigateToHistory) {
				changeWindow('history')
			}
		}

		window.addEventListener('mousemove', handleWindowMouseMove)
		window.addEventListener('mouseup', handleWindowMouseUp)

		return () => {
			window.removeEventListener('mousemove', handleWindowMouseMove)
			window.removeEventListener('mouseup', handleWindowMouseUp)
		}
	}, [page])


	// Ejecutar fetchGlucose cada 1 minuto si hay datos de glucosa (ya logueado)
	useEffect(() => {
		if (!glucose) return // no iniciar intervalo si no hay glucosa (login pendiente)

		const intervalId = setInterval(() => {
			fetchGlucose(username, password, version)
		}, 90 * 1000) // 90 segundos

		return () => clearInterval(intervalId) // limpiar al desmontar
	}, [glucose, username, password])

	const fetchGlucose = async (user: string, pass: string, ver: string) => {
		try {
			setError('')
			// setLoading(true)
			const response = await window.electron.invoke('get-glucose', {
				username: user,
				password: pass,
				version: ver
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
				setError('Bad credentials or network error.')
			} else {
				setError('Too many request to libreLink account, try again in 90 seconds OR try another version number')
			}
			return false

		} finally {
			// setLoading(false)
		}
	}


	const handleLogin = async () => {
		setLoading(true)
		const success = await fetchGlucose(username, password, version)
		if (success) {
			await window.electron.invoke('save-credentials', { username, password, version }) // 🔁 esto falta
			changeWindow('main')
		} else {
			changeWindow('login') // 👈 asegura que vuelva al tamaño login
		}
		setLoading(false)
	}

	const handleLogout = async () => {
		await window.electron.invoke('clear-credentials')
		setUsername('')
		setPassword('')
		setGlucose(null)
		setHistory([])
		setVersion('5.3.0')
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
					<p><strong>Value:</strong> {data.value} mg/dL</p>
					<p><strong>Time:</strong> {data.timestamp}</p>
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

	function getColorByGlucoseValue(value: number, isChart: boolean): string {
		const a = isChart
		console.log(a)
		if (value > 240) return '#E86D0E';
		if (value > 180) return '#FFBC01';
		if (value >= 70) return !isChart ? 'white' : 'black';
		// if (value >= 70) return '#90CB3D';
		return '#ED1C26';
	}

	const handleExit = () => {
		window.close()
	}

	const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
	const mainScale = clamp(Math.min(windowSize.width / 56, windowSize.height / 34), 0.55, 6)
	const mainValueFontSize = Math.round(clamp(18 * mainScale, 10, 108))
	const mainArrowFontSize = Math.round(clamp(16 * mainScale, 9, 96))
	const mainGap = '0px'
	const mainDragThreshold = 4

	const handleMainMouseDown = async (e: React.MouseEvent<HTMLDivElement>) => {
		if (e.button !== 0) return

		const state = mainInteractionRef.current
		state.pointerDown = true
		state.dragging = false
		state.startScreenX = e.screenX
		state.startScreenY = e.screenY

		try {
			const bounds = await window.electron.invoke('get-window-bounds')
			state.offsetX = e.screenX - bounds.x
			state.offsetY = e.screenY - bounds.y
		} catch {
			state.offsetX = 0
			state.offsetY = 0
		}
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
					<h2 style={{ ...styles.title, marginTop: '16px' }}>Loading...</h2>
				</div>
			</div>
		)
	}

	if (glucose && page === 'main') {

		return (
			<div
				onMouseDown={handleMainMouseDown}
				style={{
					backgroundColor: 'black',
					color: 'white',
					borderRadius: '9px',
					border: '1px solid rgba(255,255,255,0.18)',
					width: '100vw',
					height: '100vh',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					gap: mainGap,
					padding: 0,
					boxSizing: 'border-box',
					overflow: 'hidden',
					cursor: 'grab',
				} as any}
			>
				<p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: `${Math.max(2, Math.round(mainScale * 2))}px` }}>
					{error ?
						<>
							<strong style={{ color: '#ED1C26', fontSize: Math.max(10, Math.round(12 * mainScale)) }}>Error</strong>
						</>
						:
						<>
							{/* <strong style={{fontSize: 12}}>mg/dL:</strong><strong style={{ color: getColorByGlucoseValue(glucose.value), fontSize: 12 }}> {glucose.value} </strong> {trendToArrow(glucose.trend)} */}
							<strong style={{ color: getColorByGlucoseValue(glucose.value, false), fontSize: mainValueFontSize, lineHeight: 1 }}> {glucose.value} </strong>
							<span style={{ fontSize: mainArrowFontSize, lineHeight: 1 }}>{trendToArrow(glucose.trend)}</span>
						</>
					}
				</p>
			</div>
		)
	}

	if (page === 'history') {
		return (
			<div style={styles.page}>
				<div style={{ ...styles.card, maxWidth: '800px' }}>
					<h2 style={styles.title}>Glucose History</h2>
					{history.length === 0 ? (
						<p>No data.</p>
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
					<div style={styles.historyActions}>
						<button
							onClick={() => changeWindow('main')}
							onMouseEnter={() => setHistoryHoveredButton('back')}
							onMouseLeave={() => setHistoryHoveredButton(null)}
							style={{
								...styles.historyPrimaryButton,
								...(historyHoveredButton === 'back' ? styles.historyPrimaryButtonHover : {})
							}}
						>
							Back
						</button>
						<div style={styles.historySecondaryActions}>
							<button
								onClick={handleLogout}
								onMouseEnter={() => setHistoryHoveredButton('logout')}
								onMouseLeave={() => setHistoryHoveredButton(null)}
								style={{
									...styles.historySecondaryButton,
									...(historyHoveredButton === 'logout' ? styles.historySecondaryButtonHover : {})
								}}
							>
								Logout
							</button>
							<button
								onClick={handleExit}
								onMouseEnter={() => setHistoryHoveredButton('exit')}
								onMouseLeave={() => setHistoryHoveredButton(null)}
								style={{
									...styles.historyDangerButton,
									...(historyHoveredButton === 'exit' ? styles.historyDangerButtonHover : {})
								}}
							>
								Exit
							</button>
						</div>
					</div>
				</div>
			</div>
		)
	}

	return (
		<div style={styles.page}>
			<h1 style={styles.loginTitle}>Glucose Read</h1>
			<div style={{ ...styles.card, WebkitAppRegion: 'no-drag' } as any}>

				<p style={{...styles.title, fontSize: "16px"}}>Login with LibreLinkUp Account</p>
				<div style={{ textAlign: 'center', marginBottom: 16 }}>
					<img
						src={logo}
						alt="Logo"
						style={{ width: 35, display: 'inline-block' }}
					/>
				</div>
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
						placeholder={"Email"}
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						style={styles.input}
					/>
					<input
						type="password"
						placeholder={"Password"}
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						style={styles.input}
					/>
					<input
						type="text"
						placeholder={"Versión (e.g. 5.3.0)"}
						value={version}
						onChange={(e) => setVersion(e.target.value)}
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
						Login
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
	historyActions: {
		marginTop: '24px',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: '12px',
		flexWrap: 'wrap',
	},
	historySecondaryActions: {
		display: 'flex',
		alignItems: 'center',
		gap: '10px',
		marginLeft: 'auto',
	},
	historyPrimaryButton: {
		padding: '11px 16px',
		border: 'none',
		borderRadius: '10px',
		backgroundColor: '#10B981',
		color: '#fff',
		fontSize: '14px',
		fontWeight: 600,
		cursor: 'pointer',
		transition: 'all 0.2s ease',
		boxShadow: '0 6px 16px rgba(16,185,129,0.25)',
		WebkitAppRegion: 'no-drag',
	} as any,
	historyPrimaryButtonHover: {
		backgroundColor: '#059669',
		transform: 'translateY(-1px)',
		boxShadow: '0 10px 20px rgba(5,150,105,0.3)',
	},
	historySecondaryButton: {
		padding: '11px 16px',
		border: '1px solid #cbd5e1',
		borderRadius: '10px',
		backgroundColor: '#fff',
		color: '#334155',
		fontSize: '14px',
		fontWeight: 600,
		cursor: 'pointer',
		transition: 'all 0.2s ease',
		boxShadow: '0 2px 8px rgba(15,23,42,0.08)',
		WebkitAppRegion: 'no-drag',
	} as any,
	historySecondaryButtonHover: {
		borderColor: '#94A3B8',
		backgroundColor: '#F8FAFC',
		transform: 'translateY(-1px)',
		boxShadow: '0 8px 16px rgba(15,23,42,0.12)',
	},
	historyDangerButton: {
		padding: '11px 16px',
		border: '1px solid #FCA5A5',
		borderRadius: '10px',
		backgroundColor: '#FFF1F2',
		color: '#BE123C',
		fontSize: '14px',
		fontWeight: 700,
		cursor: 'pointer',
		transition: 'all 0.2s ease',
		boxShadow: '0 2px 8px rgba(190,18,60,0.12)',
		WebkitAppRegion: 'no-drag',
	} as any,
	historyDangerButtonHover: {
		borderColor: '#FB7185',
		backgroundColor: '#FFE4E6',
		color: '#9F1239',
		transform: 'translateY(-1px)',
		boxShadow: '0 8px 16px rgba(190,18,60,0.2)',
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
