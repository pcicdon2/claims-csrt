// Node.js Express Server with SQLite Database
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// Serve static files from current directory
app.use(express.static(__dirname));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Initialize SQLite Database
const db = new sqlite3.Database('./pcic_database.db', (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

// Create tables
function initializeDatabase() {
    db.run(`
        CREATE TABLE IF NOT EXISTS peo_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            original_name TEXT,
            file_path TEXT NOT NULL,
            type TEXT,
            size INTEGER,
            peo_office TEXT NOT NULL,
            adjuster TEXT NOT NULL,
            upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            download_date DATETIME,
            auto_delete_scheduled BOOLEAN DEFAULT 0
        )
    `, (err) => {
        if (err) {
            console.error('Error creating table:', err);
        } else {
            console.log('Database table ready');
        }
    });
}

// API Routes

// Get all files by PEO office
app.get('/api/files/:peoOffice', (req, res) => {
    const { peoOffice } = req.params;
    
    db.all(
        'SELECT * FROM peo_files WHERE peo_office = ? ORDER BY upload_date DESC',
        [peoOffice],
        (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json(rows);
            }
        }
    );
});

// Get file by ID
app.get('/api/file/:id', (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT * FROM peo_files WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (!row) {
            res.status(404).json({ error: 'File not found' });
        } else {
            res.json(row);
        }
    });
});

// Get adjuster file count
app.get('/api/count/:peoOffice/:adjuster', (req, res) => {
    const { peoOffice, adjuster } = req.params;
    
    db.get(
        'SELECT COUNT(*) as count FROM peo_files WHERE peo_office = ? AND adjuster = ?',
        [peoOffice, adjuster],
        (err, row) => {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json({ count: row.count });
            }
        }
    );
});

// Upload file
app.post('/api/upload', (req, res) => {
    const { name, originalName, data, type, size, peoOffice, adjuster } = req.body;
    
    if (!data || !name || !peoOffice || !adjuster) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Create directory for PEO office and adjuster
    const fileDir = path.join(uploadsDir, peoOffice, adjuster);
    if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
    }
    
    // Save file
    const filePath = path.join(fileDir, name);
    const base64Data = data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    fs.writeFile(filePath, buffer, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to save file' });
        }
        
        // Save to database
        const relativePath = path.join(peoOffice, adjuster, name);
        db.run(
            `INSERT INTO peo_files (name, original_name, file_path, type, size, peo_office, adjuster)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [name, originalName, relativePath, type, size, peoOffice, adjuster],
            function(err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                } else {
                    res.json({ success: true, id: this.lastID });
                }
            }
        );
    });
});

// Download file
app.get('/api/download/:id', (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT * FROM peo_files WHERE id = ?', [id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        const filePath = path.join(uploadsDir, row.file_path);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found on disk' });
        }
        
        // Update download date only (no auto-delete)
        db.run(
            'UPDATE peo_files SET download_date = CURRENT_TIMESTAMP WHERE id = ?',
            [id],
            (err) => {
                if (err) console.error('Error updating download date:', err);
            }
        );
        
        res.download(filePath, row.name);
    });
});

// Get file as base64 for viewing
app.get('/api/view/:id', (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT * FROM peo_files WHERE id = ?', [id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        const filePath = path.join(uploadsDir, row.file_path);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found on disk' });
        }
        
        fs.readFile(filePath, (err, data) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to read file' });
            }
            
            const base64 = data.toString('base64');
            const dataUrl = `data:${row.type};base64,${base64}`;
            
            res.json({
                ...row,
                dataUrl: dataUrl
            });
        });
    });
});

// Delete file
app.delete('/api/file/:id', (req, res) => {
    const { id } = req.params;
    deleteFile(id, (err, success) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (!success) {
            res.status(404).json({ error: 'File not found' });
        } else {
            res.json({ success: true });
        }
    });
});

// Helper function to delete file
function deleteFile(id, callback) {
    db.get('SELECT * FROM peo_files WHERE id = ?', [id], (err, row) => {
        if (err) {
            if (callback) callback(err, false);
            return;
        }
        if (!row) {
            if (callback) callback(null, false);
            return;
        }
        
        const filePath = path.join(uploadsDir, row.file_path);
        
        // Delete file from disk
        if (fs.existsSync(filePath)) {
            fs.unlink(filePath, (err) => {
                if (err) console.error('Error deleting file from disk:', err);
            });
        }
        
        // Delete from database
        db.run('DELETE FROM peo_files WHERE id = ?', [id], (err) => {
            if (callback) callback(err, !err);
            if (!err) {
                console.log(`File ${row.name} deleted successfully`);
            }
        });
    });
}

// Get all files (for admin)
app.get('/api/files', (req, res) => {
    db.all('SELECT * FROM peo_files ORDER BY upload_date DESC', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Open: http://localhost:${PORT}/upload-download.html`);
    console.log(`Database: pcic_database.db`);
    console.log(`Uploads folder: ${uploadsDir}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});
