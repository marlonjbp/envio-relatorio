const moment = require("moment")

const inicioFinal = (mesAno) => {
    const data = moment(`01-${mesAno}`, "DD-MM-YYYY")
    const inicio = data.format("YYYY-MM-DD HH:mm:ss")
    data.add(1, "month")
    data.subtract(1, "second")
    const termino = data.format("YYYY-MM-DD HH:mm:ss")
    return {
        inicio,
        termino
    }
}

const getTotalChamadasMesRecebidas = (did, mes) => {
    const { inicio, termino } = inicioFinal(mes)

    return new Promise(async (resolve, reject) => {
        try {
            const conn = await require("../service/mysql-astpp").getConnection()

            const [result] = await conn.query(`
        SELECT
          COUNT(*) AS quantidade,
          sum(billseconds) AS segundos,
          DATE_FORMAT(callstart, "%Y-%m") AS mes
        FROM
          cdrs
        WHERE
          callednum = '${did}' and
          callstart BETWEEN '${inicio}' AND '${termino}' and
          billseconds > 0
        GROUP BY
          DATE_FORMAT(callstart, "%Y-%m")
      `)

            conn.close()

            resolve(result)
        } catch (error) {
            reject(error)
        }
    })
}

const getTotalChamadasMesDiscadas = (did, mes) => {
    const { inicio, termino } = inicioFinal(mes)

    return new Promise(async (resolve, reject) => {
        try {
            const conn = await require("../service/mysql-astpp").getConnection()

            const [result] = await conn.query(`
        SELECT
          COUNT(*) AS quantidade,
          sum(billseconds) AS segundos,
          DATE_FORMAT(callstart, "%Y-%m") AS mes
        FROM
          cdrs
        WHERE
          callerid LIKE '%${did}%' and
          callstart BETWEEN '${inicio}' AND '${termino}' and
          billseconds > 0
        GROUP BY
          DATE_FORMAT(callstart, "%Y-%m")
      `)

            conn.close()

            resolve(result)
        } catch (error) {
            reject(error)
        }
    })
}

module.exports = {
    getTotalChamadasMesRecebidas,
    getTotalChamadasMesDiscadas
}
