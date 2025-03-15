const cron = require('node-cron')
const fs = require('fs-extra')
const path = require('path')
const archiver = require('archiver')
const { execSync } = require('child_process')
const { initializeDropbox } = require('./config/dropboxConfig') // Import Dropbox Configuration

// **Define Months for Date Formatting**
const months = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
]

// **Function to Backup Database, ZIP it, and Upload to Dropbox**
async function backupDatabase() {
  const d = new Date()
  const month = months[d.getMonth()]
  const day = d.getDate()
  const year = d.getFullYear()
  const dateString = `${month},${day} ${year}`
  const backupFile = path.join(__dirname, `CCSPayment_backup_${dateString}.sql`) // Temporary SQL File
  const zipFileName = `ArchivedFiles_${dateString}.zip`
  const zipFilePath = path.join(__dirname, zipFileName) // Temporary ZIP File

  try {
    // **Execute MySQL Dump Command**
    const cmd = `"C:\\xampp\\mysql\\bin\\mysqldump" -u root ccspayment > "${backupFile}"`
    execSync(cmd, { stdio: 'inherit' })
    console.log(`✅ Database backup successful: ${backupFile}`)

    // **ZIP the SQL Backup File**
    await zipBackupFile(backupFile, zipFilePath, dateString)

    // **Upload to Dropbox**
    await uploadToDropbox(zipFilePath, zipFileName)

    // **Delete local backup after successful upload**
    if (fs.existsSync(backupFile)) fs.removeSync(backupFile)
    if (fs.existsSync(zipFilePath)) fs.removeSync(zipFilePath)
    console.log(`🗑 Local backup deleted: ${backupFile} & ${zipFilePath}`)
  } catch (error) {
    console.error(`❌ Database backup failed: ${error.message}`)
  }
}

// **Function to ZIP the SQL Backup File**
async function zipBackupFile(backupFile, zipFilePath, dateString) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipFilePath)
    const archive = archiver('zip', { zlib: { level: 9 } }) // High compression

    output.on('close', () => {
      console.log(`📦 Backup successfully zipped: ${zipFilePath}`)
      resolve()
    })

    archive.on('error', err => reject(`❌ Error while archiving files: ${err}`))
    archive.pipe(output)

    archive.file(backupFile, { name: path.basename(backupFile) }) // Add SQL file to ZIP
    archive.finalize()
  })
}

// **Function to Upload ZIP File to Dropbox (Creates Folder If Needed)**
async function uploadToDropbox(zipFilePath, zipFileName) {
  const dropbox = await initializeDropbox()
  if (!dropbox) {
    console.error('❌ Failed to initialize Dropbox. Backup not uploaded.')
    return
  }

  const dropboxFolderPath = `/CCS_ARCHIEVED_FILES` // **Main Folder**
  const dropboxFilePath = `${dropboxFolderPath}/${zipFileName}`

  try {
    // **Check if the folder exists, if not, create it**
    try {
      await dropbox.filesGetMetadata({ path: dropboxFolderPath })
      console.log(`📂 Folder already exists: ${dropboxFolderPath}`)
    } catch (error) {
      if (error.status === 409) {
        console.log(`📂 Folder already exists: ${dropboxFolderPath}`)
      } else {
        console.log(`📂 Creating folder: ${dropboxFolderPath}`)
        await dropbox.filesCreateFolderV2({ path: dropboxFolderPath })
      }
    }

    // **Read and Upload the File to Dropbox**
    const fileContent = fs.readFileSync(zipFilePath)
    console.log(`📤 Uploading ZIP backup to Dropbox: ${dropboxFilePath}`)
    
    await dropbox.filesUpload({
      path: dropboxFilePath,
      contents: fileContent,
      mode: { ".tag": "overwrite" } // Overwrite if already exists
    })

    console.log(`✅ Backup successfully uploaded to Dropbox: ${dropboxFilePath}`)
  } catch (error) {
    console.error(`❌ Error uploading backup to Dropbox: ${error.message}`)
  }
}

cron.schedule('0 0 * * *', () => {
  console.log('🕛 Starting daily database backup...')
  backupDatabase()
}, {
  timezone: 'Asia/Manila'
})


console.log('📅 Scheduled daily database backups to Dropbox.')
