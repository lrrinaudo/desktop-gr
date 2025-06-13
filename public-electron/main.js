// public-electron/main.js
import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { LibreLinkUpClient } from '@diakem/libre-link-up-api-client'
import Store from 'electron-store'


const store = new Store();

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 400,
        height: 500,
        frame: false, // ❌ sin marco
        transparent: false, // si querés también el fondo transparente
        resizable: true, // o false si querés que no se pueda cambiar el tamaño
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: path.join(__dirname, '../src/preload.js'),
        },
    })

    mainWindow.loadURL(`file://${path.join(__dirname, '../dist/index.html')}`)

    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

    // // Registrar mensajes de consola del renderer (por si querés loggear en terminal también)
    // mainWindow.webContents.on('console-message', (_, level, message) => {
    //     console.log(`[Renderer Console] ${message}`);
    // });

}

app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

// Manejador para guardar credenciales
ipcMain.handle('save-credentials', async (_, credentials) => {
    store.set('credentials', credentials);
})

// Manejador para leer credenciales
ipcMain.handle('get-credentials', async () => {
    return store.get('credentials');
});

// Manejador de logout
ipcMain.handle('clear-credentials', async () => {
    store.delete('credentials');
});

ipcMain.on('set-window', (event, screen) => {
    const win = BrowserWindow.getAllWindows()[0]

    if (!win) return

    switch (screen) {
        case 'login':
            win.setSize(400, 500)
            break
        case 'main':
            win.setSize(55, 50)
            win.setAlwaysOnTop(true)
            // win.setResizable(false)
            break
        case 'history':
            win.setSize(800, 700)
            break
    }

    win.center()
})


ipcMain.handle('get-glucose', async (event, { username, password }) => {
    try {
        const { read } = LibreLinkUpClient({
            username,
            password,
            clientVersion: '4.9.0',
        });

        const response = await read();

        if (!response || !response.current) {
            throw new Error('No se pudo obtener data de glucosa');
        }

        // return response;
        return { status: 'ok', data: response }
    } catch (error) {
        // console.error("Error en get-glucose:", error);
        // throw error;
        
        const message = error?.message || '';

        if (message.includes('Bad credentials')) {
            return { status: 'auth_error', message: 'Credenciales inválidas' };
        }

        console.error("Error en get-glucose:", error);
        return { status: 'error', message: 'Error al conectar con el servidor o red' };
    }
})


