// Application logic for local SQLite database
let selectedPEO = '';
let selectedAdjuster = '';
let pendingFiles = [];

const API_URL = 'http://localhost:3000/api';

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
    try {
        const response = await fetch(`${API_URL}/count/${peoOffice}/${adjusterName}`);
        const data = await response.json();
        return data.count;
    } catch (error) {
        console.error('Error getting count:', error);
        return 0;
    }
}

async function displaySelectedFiles(files) {
    if (files.length === 0) return;

    const selectedFilesDiv = document.getElementById('selectedFiles');
    const saveButton = document.getElementById('saveButton');
    
    selectedFilesDiv.innerHTML = '<h3>Selected Files:</h3>';
    pendingFiles = [];

    let currentCount = await getAdjusterFileCount(selectedPEO, selectedAdjuster);

    Array.from(files).forEach((file, index) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            currentCount++;
            const fileExtension = file.name.split('.').pop();
            const newFileName = `${selectedAdjuster}_${currentCount}.${fileExtension}`;
            
            const fileData = {
                name: newFileName,
                originalName: file.name,
                type: file.type,
                size: file.size,
                data: e.target.result,
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

async function saveSelectedFiles() {
    if (pendingFiles.length === 0) {
        alert('No files to save!');
        return;
    }

    const saveButton = document.getElementById('saveButton');
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    let savedCount = 0;
    
    for (const fileData of pendingFiles) {
        try {
            const response = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(fileData)
            });
            
            if (response.ok) {
                savedCount++;
            }
        } catch (error) {
            console.error('Error saving file:', error);
        }
    }

    alert(`${savedCount} file(s) saved successfully to ${selectedPEO.toUpperCase()}!`);
    
    document.getElementById('selectedFiles').innerHTML = '';
    saveButton.style.display = 'none';
    saveButton.disabled = false;
    saveButton.textContent = 'Save to Database';
    document.getElementById('fileInput').value = '';
    pendingFiles = [];
    
    loadDownloadList();
}

async function loadDownloadList() {
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

    downloadList.innerHTML = '';
    
    for (const office of peoOffices) {
        try {
            const response = await fetch(`${API_URL}/files/${office}`);
            const files = await response.json();
            
            const item = document.createElement('div');
            item.className = 'download-item';
            item.innerHTML = `
                <span>${peoNames[office]} (${files.length} files)</span>
                <button onclick="viewPEOFiles('${office}')">View Files</button>
            `;
            downloadList.appendChild(item);
        } catch (error) {
            console.error('Error loading files:', error);
        }
    }
}

async function loadFilesForPEO(peoOffice) {
    try {
        const response = await fetch(`${API_URL}/files/${peoOffice}`);
        const files = await response.json();
        console.log(`Files for ${peoOffice}:`, files);
    } catch (error) {
        console.error('Error:', error);
    }
}

async function viewPEOFiles(peoOffice) {
    try {
        const response = await fetch(`${API_URL}/files/${peoOffice}`);
        const files = await response.json();
        
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
                                <small>${file.adjuster || 'Unknown'} - ${formatFileSize(file.size)} - ${formatDate(file.upload_date)}</small>
                            </div>
                            <div class="file-actions">
                                <button onclick="viewImage(${file.id}, '${peoOffice}')">View Image</button>
                                <button class="delete-btn" onclick="deleteFile(${file.id}, '${peoOffice}')">Delete</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        console.error('Error:', error);
        alert('Error loading files');
    }
}

async function viewImage(fileId, peoOffice) {
    try {
        const response = await fetch(`${API_URL}/view/${fileId}`);
        const file = await response.json();
        
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
                        <p><strong>Uploaded:</strong> ${formatDate(file.upload_date)}</p>
                    </div>
                    <div class="image-container" id="printable-area-${fileId}">
                        <img src="${file.dataUrl}" alt="${file.name}">
                    </div>
                    <div class="button-group">
                        <button class="print-btn" onclick="printImage(${file.id})">Print Image</button>
                        <button class="download-btn" onclick="downloadFile(${file.id})">Download Image</button>
                    </div>
                </div>
            `;
            document.body.appendChild(imageModal);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error viewing image');
    }
}

function printImage(fileId) {
    const printArea = document.getElementById(`printable-area-${fileId}`);
    const img = printArea.querySelector('img');
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Print Image</title>
            <style>
                body {
                    margin: 0;
                    padding: 20px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                }
                img {
                    max-width: 100%;
                    height: auto;
                }
                @media print {
                    body {
                        padding: 0;
                    }
                    img {
                        max-width: 100%;
                        page-break-inside: avoid;
                    }
                }
            </style>
        </head>
        <body>
            <img src="${img.src}" alt="Print Image">
        </body>
        </html>
    `);
    
    printWindow.document.close();
    
    // Wait for image to load then print
    printWindow.onload = function() {
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    };
}

async function downloadFile(fileId) {
    window.open(`${API_URL}/download/${fileId}`, '_blank');
}

async function deleteFile(fileId, peoOffice) {
    if (confirm('Are you sure you want to delete this file?')) {
        try {
            const response = await fetch(`${API_URL}/file/${fileId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                alert('File deleted successfully!');
                const modals = document.querySelectorAll('.modal');
                modals.forEach(modal => modal.remove());
                loadDownloadList();
                setTimeout(() => viewPEOFiles(peoOffice), 100);
            } else {
                alert('Failed to delete file!');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error deleting file');
        }
    }
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
}

function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}
