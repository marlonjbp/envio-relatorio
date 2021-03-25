require("dotenv").config()
const calllog = require("./model/calllog")
const xlsx = require("xlsx")
const fs = require("fs")
const { format, subWeeks, startOfWeek, endOfWeek } = require("date-fns")

const { enviarEmail } = require("./service/mail")

const executar = async () => {
    const hoje = new Date()
    const inicio = format(startOfWeek(subWeeks(hoje, 1)), "dd-MM-yyyy HH:mm:ss")
    const termino = format(endOfWeek(subWeeks(hoje, 1)), "dd-MM-yyyy HH:mm:ss")

    const result = await calllog.getCdrFromDomain({
        domain: "gutierrezpneus.brastel.com.br",
        dids: ["551122398083", "551123052133", "551135884303", "551135884314"],
        start: inicio,
        end: termino
    })
    const ws1 = xlsx.utils.json_to_sheet(result[0])
    const ws2 = xlsx.utils.json_to_sheet(result[1])
    const wb = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(wb, ws2, "Totais")
    xlsx.utils.book_append_sheet(wb, ws1, "Chamadas")
    xlsx.writeFile(wb, "./relatorio-gutierrezpneus.xlsx")

    // Enviar email
    const corpo = `<p>Bom dia,<p>
    <p>Segue em anexo relatório semanal das chamadas recebidas da Gutierrez Pneus.<p>
    <p>Atenciosamente<p>
    <p>Suporte Basix<p>`

    await enviarEmail(
        "rodrigo@gutierrezpneus.com.br, sorsolini@cloudcom.com.br, atendimento@olibonepneus.com.br, suporte.basix@cloudcom.com.br",
        "Relatório Semanal - GUTIERREZ PNEUS",
        corpo,
        "relatorio-bibi-24-03-2021.xlsx"
    )
    fs.unlinkSync("./relatorio-gutierrezpneus.xlsx")
}

executar()
