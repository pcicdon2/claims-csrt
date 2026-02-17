// File upload and download functionality
let selectedPEO = '';
let selectedAdjuster = '';
let pendingFiles = [];

document.addEventListener('DOMContentLoaded', function() {
    const peoDropdown = document.getElementById('peoDropdown');
    const adjusterDropdown = document.getElementById('adjusterDropdown');
    const adjusterSelect = document.getElementById('adjusterSelect');
    const fileInput = document.getElementById('fileInput');

    // Handle PEO selection
    peoDropdown.addEventListener('change', function() {
        selectedPEO = this.value;
        if (selectedPEO) {
            adjusterSelect.style.display = 'block';
            loadFilesForPEO(selectedPEO);
        } else {
            adjusterSelect.style.display = 'none';
            selectedAdjuster = '';
            adjusterDropdown.value = '';
        }
    });

    // Handle Adjuster selection
    adjusterDropdown.addEventListener('change', function() {
        selectedAdjuster = this.value;
    });

    // Handle file selection
    fileInput.addEventListener('change', function() {
        if (!selectedPEO) {
            alert('Please select a PEO office first!');
            this.value = '';
            return;
        }
        if (!selectedAdjuster) {
            alert('Please select an Adjuster first!');
            this.value = '';
            return;
        }
        displaySelectedFiles(this.files);
    });

    // Load initial download list
    loadDownloadList();
});

async function getAdjusterFileCount(peoOffice, adjusterName) {
    const files = await db.getFilesByPEO(peoOffice);
    const adjusterFiles = files.filter(f => f.adjuster === adjusterName);
    return adjusterFiles.length;
}

async function displaySelectedFiles(files) {
    if (files.length === 0) return;

    const selectedFilesDiv = document.getElementById('selectedFiles');
    const saveButton = document.getElementById('saveButton');
    
    selectedFilesDiv.innerHTML = '<h3>Selected Files:</h3>';
    pendingFiles = [];

    // Get current count for this adjuster
    let currentCount = await getAdjusterFileCount(selectedPEO, selectedAdjuster);

    Array.from(files).forEach((file, index) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            currentCount++;
            const fileExtension = file.name.split('.').pop();
            const newFileName = `${selectedAdjuster}_${currentCount}.${fileExtension}`;
            
            const fileData = {
                id: Date.now() + Math.random(),
                name: newFileName,
                originalName: file.name,
                type: file.type,
                size: file.size,
                data: e.target.result,
                uploadDate: new Date().toISOString(),
                peoOffice: selectedPEO,
                adjuster: selectedAdjuster
            };

            pendingFiles.push(fileData);

            const filePreview = document.createElement('div');
            filePreview.className = 'file-preview';
            filePreview.innerHTML = `
                <img src="${e.target.result}" alt="${newFileName}">
                <div class="file-preview-info">
                    <strong>${newFileName}</strong>
                    <small>${formatFileSize(file.size)}</small>
                </div>
            `;
            selectedFilesDiv.appendChild(filePreview);
        };

        reader.readAsDataURL(file);
    });

    saveButton.style.display = 'block';
}

function saveSelectedFiles() {
    if (pendingFiles.length === 0) {
        alert('No files to save!');
        return;
    }

    let savedCount = 0;
    const savePromises = pendingFiles.map(fileData => 
        db.saveFile(selectedPEO, fileData)
            .then(() => savedCount++)
            .catch(err => console.error('Error saving file:', err))
    );

    Promise.all(savePromises).then(() => {
        alert(`${savedCount} file(s) saved successfully to ${selectedPEO.toUpperCase()}!`);
        
        // Clear the selection
        document.getElementById('selectedFiles').innerHTML = '';
        document.getElementById('saveButton').style.display = 'none';
        document.getElementById('fileInput').value = '';
        pendingFiles = [];
        
        loadDownloadList();
    });
}

function loadDownloadList() {
    const downloadList = document.querySelector('.download-list');
    downloadList.innerHTML = '<div style="text-align: center; padding: 10px;">Loading...</div>';

    const peoOffices = ['butuan', 'sanfrancisco', 'surigao', 'tandag', 'valencia'];
    const peoNames = {
        butuan: 'PEO BUTUAN',
        sanfrancisco: 'PEO SAN FRANCISCO',
        surigao: 'PEO SURIGAO',
        tandag: 'PEO TANDAG',
        valencia: 'PEO VALENCIA'
    };

    const promises = peoOffices.map(office => 
        db.getFilesByPEO(office).then(files => ({
            office,
            name: peoNames[office],
            count: files.length
        }))
    );

    Promise.all(promises).then(results => {
        downloadList.innerHTML = '';
        results.forEach(result => {
            const item = document.createElement('div');
            item.className = 'download-item';
            item.innerHTML = `
                <span>${result.name} (${result.count} files)</span>
                <button onclick="viewPEOFiles('${result.office}')">View Files</button>
            `;
            downloadList.appendChild(item);
        });
    });
}

function loadFilesForPEO(peoOffice) {
    db.getFilesByPEO(peoOffice).then(files => {
        console.log(`Files for ${peoOffice}:`, files);
    });
}

function viewPEOFiles(peoOffice) {
    db.getFilesByPEO(peoOffice).then(files => {
        if (files.length === 0) {
            alert(`No files uploaded for ${peoOffice.toUpperCase()} yet.`);
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
                <h2>${peoOffice.toUpperCase()} Files</h2>
                <div class="file-list">
                    ${files.map(file => `
                        <div class="file-item">
                            <div class="file-info">
                                <strong>${file.name}</strong>
                                <small>${file.adjuster || 'Unknown'} - ${formatFileSize(file.size)} - ${formatDate(file.uploadDate)}</small>
                            </div>
                            <div class="file-actions">
                                <button onclick="viewImage('${file.id}', '${peoOffice}')">View Image</button>
                                <button class="delete-btn" onclick="deleteFile('${file.id}', '${peoOffice}')">Delete</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    });
}

function viewImage(fileId, peoOffice) {
    db.getFilesByPEO(peoOffice).then(files => {
        const numericId = parseFloat(fileId);
        const file = files.find(f => f.id === numericId);
        
        if (file) {
            const imageModal = document.createElement('div');
            imageModal.className = 'modal image-modal';
            imageModal.innerHTML = `
                <div class="modal-content image-modal-content">
                    <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
                    <h2>${file.name}</h2>
                    <div class="image-info">
                        <p><strong>Adjuster:</strong> ${file.adjuster || 'Unknown'}</p>
                        <p><strong>Size:</strong> ${formatFileSize(file.size)}</p>
                        <p><strong>Uploaded:</strong> ${formatDate(file.uploadDate)}</p>
                    </div>
                    <div class="image-container">
                        <img src="${file.data}" alt="${file.name}">
                    </div>
                    <button class="download-btn" onclick="downloadFileFromView('${file.id}', '${peoOffice}')">Download Image</button>
                </div>
            `;
            document.body.appendChild(imageModal);
        }
    });
}

function downloadFileFromView(fileId, peoOffice) {
    db.getFilesByPEO(peoOffice).then(files => {
        const numericId = parseFloat(fileId);
        const file = files.find(f => f.id === numericId);
        
        if (file) {
            const link = document.createElement('a');
            link.href = file.data;
            link.download = file.name;
            link.click();
            
            // Start silent countdown to delete after 2 minutes
            startSilentDeleteCountdown(fileId, peoOffice, file.name);
        }
    });
}

function startSilentDeleteCountdown(fileId, peoOffice, fileName) {
    const countdownTime = 120000; // 2 minutes in milliseconds
    
    // Set timeout to delete after 2 minutes
    setTimeout(() => {
        db.deleteFile(peoOffice, fileId).then(success => {
            if (success) {
                // Refresh the download list if user is still on the page
                loadDownloadList();
            }
        });
    }, countdownTime);
}

function downloadFile(fileId, peoOffice) {
    db.getFilesByPEO(peoOffice).then(files => {
        const numericId = parseFloat(fileId);
        const file = files.find(f => f.id === numericId);
        
        if (file) {
            const link = document.createElement('a');
            link.href = file.data;
            link.download = file.name;
            link.click();
        }
    });
}

function deleteFile(fileId, peoOffice) {
    if (confirm('Are you sure you want to delete this file?')) {
        db.deleteFile(peoOffice, fileId).then(success => {
            if (success) {
                alert('File deleted successfully!');
                // Close all modals
                const modals = document.querySelectorAll('.modal');
                modals.forEach(modal => modal.remove());
                loadDownloadList();
                // Reopen the file list modal
                setTimeout(() => viewPEOFiles(peoOffice), 100);
            } else {
                alert('Failed to delete file!');
            }
        }).catch(err => {
            console.error('Delete error:', err);
            alert('Error deleting file!');
        });
    }
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}
