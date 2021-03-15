require("dotenv").config()
const calllog = require("./model/calllog")
const xlsx = require("xlsx")

const executar = async () => {
    const result = await calllog.getCdrFromDomain({
        domain: "gutierrezpneus.brastel.com.br",
        dids: ["551122398083", "551123052133", "551135884303", "551135884314"],
        start: "07-03-2021 00:00:00",
        end: "13-03-2021 23:59:59"
    })

    const ws1 = xlsx.utils.json_to_sheet(result[0])
    const ws2 = xlsx.utils.json_to_sheet(result[1])

    const wb = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(wb, ws2, "Totais")
    xlsx.utils.book_append_sheet(wb, ws1, "Chamadas")

    xlsx.writeFile(wb, "./relatorio-gutierrezpneus.xlsx")
}

executar()
