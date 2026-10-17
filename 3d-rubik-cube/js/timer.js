const STORAGE_KEY = 'rubiks_cube_history_v2';

export class Timer {
    constructor() {
        this.state = 'IDLE'; // IDLE, READY, RUNNING, STOPPED
        this.startTime = 0;
        this.elapsedTime = 0;
        this.history = this.loadHistory();
    }

    start() {
        if (this.state === 'READY' || this.state === 'IDLE') {
            this.startTime = performance.now();
            this.state = 'RUNNING';
        }
    }

    stop() {
        if (this.state === 'RUNNING') {
            this.elapsedTime = performance.now() - this.startTime;
            this.state = 'STOPPED';
        }
    }

    reset() {
        this.state = 'IDLE';
        this.elapsedTime = 0;
    }

    getElapsedTime() {
        return this.state === 'RUNNING' ? performance.now() - this.startTime : this.elapsedTime;
    }

    saveRecord(time, scramble) {
        this.history.push({
            time: time,
            date: new Date().toLocaleString(),
            scramble: scramble
        });
        this.saveToStorage();
    }

    clearHistory() {
        this.history = [];
        this.saveToStorage();
    }

    getStats() {
        const times = this.history.map(r => r.time);
        const best = times.length ? Math.min(...times) : null;
        const ao5 = this.getAverage(times, 5);
        const ao12 = this.getAverage(times, 12);
        return { best, ao5, ao12, count: times.length };
    }

    getAverage(times, n) {
        if (times.length < n) return null;
        const slice = times.slice(-n);
        const max = Math.max(...slice);
        const min = Math.min(...slice);
        const sum = slice.reduce((a, b) => a + b, 0) - max - min;
        return sum / (n - 2);
    }

    exportJSON() {
        return JSON.stringify(this.history, null, 2);
    }

    exportCSV() {
        let csv = 'Time (ms),Formatted Time,Date,Scramble\n';
        this.history.forEach(r => {
            csv += `${r.time},${formatTime(r.time)},"${r.date}","${r.scramble}"\n`;
        });
        return csv;
    }

    loadHistory() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) { return []; }
    }

    saveToStorage() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history)); } catch (e) {}
    }
}

export function formatTime(ms) {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const cs = Math.floor((ms % 1000) / 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}