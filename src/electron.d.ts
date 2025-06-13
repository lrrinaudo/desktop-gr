// src/electron.d.ts
export {};

declare global {
	interface Window {
		electron: {
			invoke: (channel: string, ...args: any[]) => Promise<any>;
			send: (channel: string, ...args: any[]) => void;
		};
	}
}
