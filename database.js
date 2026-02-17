// Database management for PEO file uploads using IndexedDB
class PEODatabase {
    constructor() {
        this.dbName = 'PEOUploadsDB';
        this.dbVersion = 1;
        this.storeName = 'files';
        this.db = null;
        this.initPromise = this.initDatabase();
    }

    initDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('Database failed to open');
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('Database opened successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, { keyPath: 'id' });
                    objectStore.createIndex('peoOffice', 'peoOffice', { unique: false });
                    objectStore.createIndex('uploadDate', 'uploadDate', { unique: false });
                }
            };
        });
    }

    async saveFile(peoOffice, fileData) {
        await this.initPromise;
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            
            fileData.peoOffice = peoOffice;
            const request = objectStore.add(fileData);

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = () => {
                console.error('Error saving file:', request.error);
                reject(request.error);
            };
        });
    }

    async getFilesByPEO(peoOffice) {
        await this.initPromise;
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const index = objectStore.index('peoOffice');
            const request = index.getAll(peoOffice);

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                console.error('Error getting files:', request.error);
                reject(request.error);
            };
        });
    }

    async getAllFiles() {
        await this.initPromise;
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    async deleteFile(peoOffice, fileId) {
        await this.initPromise;
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const numericId = parseFloat(fileId);
            const request = objectStore.delete(numericId);

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = () => {
                console.error('Error deleting file:', request.error);
                reject(request.error);
            };
        });
    }

    async clearAll() {
        await this.initPromise;
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.clear();

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    async getTotalSize() {
        const files = await this.getAllFiles();
        return files.reduce((total, file) => total + (file.size || 0), 0);
    }
}

const db = new PEODatabase();
