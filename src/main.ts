import './ui/style.css';
import { App } from './app';
import { UI } from './ui/ui';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const app = new App(canvas);
const ui = new UI(app);
// Handy for poking at the machine from the browser console.
Object.assign(window as unknown as Record<string, unknown>, { app, ui });
app.start();
