const { makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const pino = require("pino")
const qrcode = require("qrcode-terminal")
const dbPool = require("./knex")
require('dotenv').config()
const dayjs = require('dayjs')

const pic_phone = process.env.PIC_PHONE?.split(',').map(n => n.trim()) || []

async function connectToWhatsApp() {
  const authState = await useMultiFileAuthState("session")
  const socket = makeWASocket({
    browser: ['windows', 'chrome', '10'],
    auth: authState.state,
    logger: pino({ level: "silent" })
  })

  socket.ev.on('creds.update', authState.saveCreds)

  socket.ev.on('connection.update', ({ connection, qr }) => {
    if (qr) {
      console.log("Scan QR code below to login:")
      qrcode.generate(qr, { small: true }) 
      console.log('\n')// tampilkan QR di terminal
    }

    if (connection == 'open') {
      console.log("WA Bot Active")

      // Lakukan sesuatu pada whatsapp disini
      checkingStatusDevice(socket, pic_phone)

    } else if (connection == 'close') {
      console.log("WA Bot Closed")
      connectToWhatsApp()
    } else if (connection == 'connecting') {
      console.log('WA Bot Connecting')
    }
  })

  socket.ev.on('messages.upsert', async ({ messages, type }) => {
    if (!messages || messages.length === 0) return

    const msg = messages[0]

    const remoteJid = msg.key.remoteJid
    const conversation =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption || null

    if (!conversation) return // abaikan pesan tanpa isi

    if (msg.key.fromMe) {
      // Pesan keluar (dikirim oleh bot sendiri)
      console.log('[MESSAGE OUT]', { remoteJid, conversation })
    } else {
      // Pesan masuk (dikirim oleh user)
      console.log('[MESSAGE IN]', { remoteJid, conversation })
    }
  })
}

async function sendMessageToPeople(socket, nomorList, isiPesan) {
  const daftarNomor = Array.isArray(nomorList) ? nomorList : [nomorList] // normalisasi ke array

  for (const nomor of daftarNomor) {
    const jid = nomor.endsWith('@s.whatsapp.net') ? nomor : nomor + '@s.whatsapp.net'
    try {
      const sent = await socket.sendMessage(jid, { text: isiPesan })
      console.log(`✅ Pesan terkirim ke ${nomor}`, sent.key.id)
    } catch (error) {
      console.error(`❌ Gagal kirim ke ${nomor}:`, error.message)
    }
  }
}

async function checkingStatusDevice(socket, nomorList) {
  const deviceStatus = await dbPool("device_status as ds").select("ds.*", "r.room_name").join("rooms as r", "ds.id_room", "r.id_room").orderBy("r.room_name", "asc")

  const disconnectedDevices = deviceStatus
    .filter(device => device.status === 0)
    .map((device, index) => `${index + 1}. ${device.room_name}\n   Last Connection:\n   ${dayjs(device.updated_at).format("YYYY-MM-DD HH:mm:ss")}\n   Status : ❌ Disconnected`)


  const text = '📋 *Information Tablet Meeting Room Status* 📋\n\n' + disconnectedDevices.join('\n\n') + '\n\n⚠️ Need to check tablet device. ⚠️'


  sendMessageToPeople(socket, nomorList, text)
}


connectToWhatsApp()

