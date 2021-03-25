const nodemailer = require("nodemailer")

const transportCloud = nodemailer.createTransport({
    service: "gmail",
    secure: true,
    port: 465,
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
    }
})

const enviarEmail = (to, title, html, filename) => {
    return new Promise((resolve, reject) => {
        try {
            const HelperOptions = {
                from: process.env.GMAIL_FROM,
                to,
                cc: process.env.GMAIL_CC,
                replyTo: {
                    name: process.env.GMAIL_REPLY_TO_NAME,
                    address: process.env.GMAIL_REPLY_TO_EMAIL
                },
                subject: title,
                html,
                attachments: [
                    {
                        filename,
                        path: `./${filename}`
                    }
                ]
            }

            transportCloud.sendMail(HelperOptions, (error, info) => {
                if (error) {
                    resolve(error)
                } else {
                    resolve(info)
                }
            })
        } catch (error) {
            reject(error)
        }
    })
}

module.exports = {
    enviarEmail
}
