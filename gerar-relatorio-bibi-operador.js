require("dotenv").config()
const callcenter = require("./model/callcenter")

const executar = async () => {
    const relatorioPaData = await callcenter.callcenterRelatorioPADiario({
        dominio: "cloud.cloudcom.com.br",
        inicio: "23/02/2021 00:00:00",
        termino: "24/02/2021 00:00:00"
    })

    console.log(relatorioPaData)
}

executar()
