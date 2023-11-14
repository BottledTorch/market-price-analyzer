import * as XLSX from 'xlsx';

export async function updateExcel(file, dataToUpdate) {
    try {
        console.log('updating excel:', dataToUpdate);

        // Read the uploaded Excel file
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = e.target.result;
            const oldWorkbook = XLSX.read(data, { type: 'binary' });
            const oldSheet = oldWorkbook.Sheets[oldWorkbook.SheetNames[0]];

            // Convert old sheet to array of arrays (AoA)
            const oldSheetData = XLSX.utils.sheet_to_json(oldSheet, { header: 1 });

            // Add the new column data to each row in the old sheet data
            oldSheetData[0].push("MPA Prediction")
            for (const update of dataToUpdate) {
                const { row, prediction } = update;
                oldSheetData[row].push(prediction)
            }

            // Create a new workbook and a new sheet with the updated data
            const newWorkbook = XLSX.utils.book_new();
            const newSheet = XLSX.utils.aoa_to_sheet(oldSheetData);

            // Add the new sheet to the workbook
            XLSX.utils.book_append_sheet(newWorkbook, newSheet, "UpdatedSheet");

            // Convert the updated workbook to a Blob and trigger a download
            const wbout = XLSX.write(newWorkbook, { bookType: 'xlsx', type: 'binary' });
            const blob = new Blob([s2ab(wbout)], { type: 'application/octet-stream' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'updated-file.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            console.log("New Excel generated and downloaded successfully!");
        };
        reader.readAsBinaryString(file);
    } catch (error) {
        console.error("Error generating new Excel:", error.message, error.stack);
    }
}

// Helper function to convert string to ArrayBuffer
function s2ab(s) {
  const buf = new ArrayBuffer(s.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < s.length; i++) {
      view[i] = s.charCodeAt(i) & 0xFF;
  }
  return buf;
}
