require("dotenv").config()
const calllog = require("./model/calllog")
const xlsx = require("xlsx")
const fs = require("fs")
const { format, subDays } = require("date-fns")

const { enviarEmail } = require("./service/mail")

const executar = async () => {
    const hoje = new Date()

    const inicio = format(subDays(hoje, 1), "dd-MM-yyyy 00:00:00")
    const termino = format(subDays(hoje, 1), "dd-MM-yyyy 23:59:59")
    const nomeArquivo = format(subDays(hoje, 1), "dd-MM-yyyy")

    const result = await calllog.getCdrFromDomainCallCenter(
        "bibi.cloudcom.com.br",
        ["555135008315", "555135123399"],
        inicio,
        termino
    )

    const ws1 = xlsx.utils.json_to_sheet(result[0])
    const ws2 = xlsx.utils.json_to_sheet(result[1])

    const wb = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(wb, ws2, "Totais")
    xlsx.utils.book_append_sheet(wb, ws1, "Chamadas")

    xlsx.writeFile(wb, `./relatorio-bibi-${nomeArquivo}.xlsx`)

    // Enviar email
    const corpo = `<p>Bom dia,<p>
    <p>Segue em anexo relatório diario das chamadas recebidas da BIBI.<p>
    <p>Atenciosamente<p>
    <p>Suporte Basix<p>`

    await enviarEmail(
        "gueidel@bibi.com.br, lucas.cardozo@bibi.com.br, suporte.basix@cloudcom.com.br",
        "Relatório Diário - BIBI",
        corpo,
        "relatorio-bibi-24-03-2021.xlsx"
    )
    fs.unlinkSync(`./relatorio-bibi-${nomeArquivo}.xlsx`)
}

executar()
