const moment = require("moment")

const arrayToList = (total, item, index, lista) => {
    if (index === 0 && index === lista.length - 1) {
        return (total = `'${item}'`)
    }

    if (index === lista.length - 1) {
        return (total = total + `'${item}'`)
    }

    return (total = total + `'${item}', `)
}

const formatar = (data) => {
    const columns = data.metaData.map((item) => item.name)
    data = data.rows.map((item) => {
        const obj = {}

        item.map((info, index) => {
            obj[columns[index]] = info
            return obj
        })

        const start = moment(obj.INICIO, "DD-MM-YYYY HH:mm:ss")
        const end = moment(obj.TERMINO, "DD-MM-YYYY HH:mm:ss")
        const duracao = moment.duration(end.diff(start))
        obj.DURACAO = duracao.as("seconds")

        return obj
    })
    return data
}

const getDetalhesDiaChamadasDiscadas = (dominio, did, dia) => {
    return new Promise(async (resolve, reject) => {
        try {
            const conn = await require("../service/oracle-cloud").getConnection()

            const rows = await conn.execute(`
        select
            u.VCH_USERNAME as usuario,
            cl.VCH_DISPLAY as destino,
            cl.INT_CALLTYPE as tipo, -- 7 recebida, 6 discada
            cl.INT_STATUS as estado, -- 30 transferida, 25 conectada, 28 não respondido, 36 não existe
            cl.VCH_FORWARDEDADDRESS,
            TO_CHAR(cl.DTM_FROM_DATE,'DD-MM-YYYY HH24:MI:SS') as inicio,
            TO_CHAR(cl.DTM_UNTIL_DATE,'DD-MM-YYYY HH24:MI:SS') as termino,
            cl.VCH_MYADDRESS as DDR
        from
            BASIXBRASTEL.tbl_pbx_calllog cl,
            BASIXBRASTEL.tbl_pbx_pbxuser pu,
            BASIXBRASTEL.tbl_sys_user u,
            BASIXBRASTEL.tbl_sys_domain d
        where
            d.vch_domain = '${dominio}'
            and d.int_domain_key = u.int_domain_key
            and u.int_user_key = pu.int_user_key
            and cl.int_pbxuser_key = pu.int_pbxuser_key
            and cl.dtm_from_date BETWEEN TO_DATE('${dia} 00:00:00','DD-MM-YYYY HH24:MI:SS') and TO_DATE('${dia} 23:59:59','DD-MM-YYYY HH24:MI:SS')
            and cl.vch_myaddress = '${did}' and
            cl.int_calltype = 6
        order by
            cl.INT_CALLLOG_KEY
      `)
            conn.close()

            let result = formatar(rows)
            result = result.filter((item) => item.DURACAO > 0)
            const segundos = result.reduce((total, item) => {
                return (total += item.DURACAO)
            }, 0)

            let total = moment.duration(segundos, "seconds")
            total = `${total
                .get("hours")
                .toString()
                .padStart(2, "0")}:${total
                .get("minutes")
                .toString()
                .padStart(2, "0")}:${total
                .get("seconds")
                .toString()
                .padStart(2, "0")}`

            resolve({ [dia]: total })
        } catch (error) {
            reject(error)
        }
    })
}

const getCdr = ({ inicio, termino }) => {
    return new Promise(async (resolve, reject) => {
        try {
            const conn = await require("../service/oracle-cloud").getConnection()

            let { rows } = await conn.execute(`
        select
            distinct vch_callid
        from(
        select
            vch_callid
        from
            BASIXBRASTEL.tbl_pbx_systemcalllog
        where
            int_domain_key = 527 and
            vch_to in ('551135881620', '551140033087') and
            dtm_starttime BETWEEN TO_DATE('${inicio}', 'DD-MM-YYYY HH24:MI:SS') and
            TO_DATE('${termino}', 'DD-MM-YYYY HH24:MI:SS')
        order by
            dtm_starttime
        desc)
      `)

            rows = rows.map((item) => item[0])
            const lista = []

            for (let i = 0; i < rows.length; i++) {
                const item = rows[i]

                const result = await conn.execute(`
          select
            int_connectionsequence,
            vch_from,
            vch_to,
            vch_target,
            vch_username,
            (((dtm_endtime) - (dtm_starttime)) * 24 * 60 * 60) as duracao,
            TO_CHAR(dtm_starttime,'DD-MM-YYYY HH24:MI:SS') as inicio,
            TO_CHAR(dtm_endtime,'DD-MM-YYYY HH24:MI:SS') as termino,
            int_status as status,
            --replace(int_status, 0, 'ESTABLISHED') as status,
            int_releasecause as desconexao
            -- replace(replace(replace(int_releasecause, 1, 'BYE (BYE)'), 6, 'TRANSFERED (BYE)'), 8 , 'NORMAL (BYE)') as desconexao
        from
            BASIXBRASTEL.tbl_pbx_systemcalllog
        where
            vch_callid = '${item}'
        order by
            int_connectionsequence
        `)

                lista[i] = result.rows
                console.log(`${i + 1} de ${rows.length}`)
            }

            conn.close()
            resolve(lista)
        } catch (error) {
            reject(error)
        }
    })
}

const getCdrFromDomain = ({ domain, dids, start, end }) => {
    return new Promise(async (resolve, reject) => {
        try {
            const conn = await require("../service/oracle-cloud").getConnection()

            let { rows } = await conn.execute(`
                select
                    distinct vch_callid
                from(
                select
                    vch_callid
                from
                    BASIXBRASTEL.tbl_pbx_systemcalllog cl,
                    BASIXBRASTEL.tbl_sys_domain d
                where
                    cl.int_domain_key = d.int_domain_key and
                    d.vch_domain = '${domain}' and
                    vch_to in (${dids.reduce(arrayToList, "")}) and
                    dtm_starttime BETWEEN TO_DATE('${start}', 'DD-MM-YYYY HH24:MI:SS') and
                    TO_DATE('${end}', 'DD-MM-YYYY HH24:MI:SS')
                order by
                    dtm_starttime
                desc)`)

            rows = rows.map((item) => item.VCH_CALLID)
            const lista = []

            for (let i = 0; i < rows.length; i++) {
                const item = rows[i]

                const result = await conn.execute(`
                    select
                        int_connectionsequence,
                        vch_from,
                        vch_to,
                        vch_target,
                        vch_username,
                        (((dtm_endtime) - (dtm_starttime)) * 24 * 60 * 60) as duracao,
                        TO_CHAR(dtm_starttime,'DD-MM-YYYY HH24:MI:SS') as inicio,
                        TO_CHAR(dtm_endtime,'DD-MM-YYYY HH24:MI:SS') as termino,
                        int_status as status,
                        --replace(int_status, 0, 'ESTABLISHED') as status,
                        int_releasecause as desconexao
                        -- replace(replace(replace(int_releasecause, 1, 'BYE (BYE)'), 6, 'TRANSFERED (BYE)'), 8 , 'NORMAL (BYE)') as desconexao
                    from
                        BASIXBRASTEL.tbl_pbx_systemcalllog
                    where
                        vch_callid = '${item}'
                    order by
                        int_connectionsequence
                    `)

                lista.push(result.rows)
                console.log(`${i + 1} de ${rows.length}`)
            }

            conn.close()

            const planilha = []
            const planilhaTotais = []

            const totais = {
                atendida: 0,
                nao_atendida: 0,
                desligou_ura: 0,
                noturno: 0
            }

            for (let i = 0; i < lista.length; i++) {
                let item = lista[i]

                item = item.map((item) => {
                    if (item.STATUS === 0) {
                        item.STATUS = "ESTABLISHED"
                    }
                    if (item.STATUS === 3) {
                        item.STATUS = "UNANSWERED"
                    }
                    if (item.STATUS === 4) {
                        item.STATUS = "BUSY"
                    }
                    if (item.STATUS === 8) {
                        item.STATUS = "CANCELED"
                    }
                    if (item.STATUS === 99) {
                        item.STATUS = "UNDEFINED"
                    }

                    if (item.DESCONEXAO === 1) {
                        item.DESCONEXAO = "BYE (BYE)"
                    }
                    if (item.DESCONEXAO === 2) {
                        item.DESCONEXAO = "CANCELED (CANCELED)"
                    }
                    if (item.DESCONEXAO === 4) {
                        item.DESCONEXAO = "UNANSWERED (CANCELED)"
                    }
                    if (item.DESCONEXAO === 6) {
                        item.DESCONEXAO = "TRANSFERED (BYE)"
                    }
                    if (item.DESCONEXAO === 8) {
                        item.DESCONEXAO = "NORMAL (BYE)"
                    }
                    if (item.DESCONEXAO === 99) {
                        item.DESCONEXAO = "UNDEFINED (UNDEFINED)"
                    }
                    if (item.DESCONEXAO === 408) {
                        item.DESCONEXAO = "TIMEOUT (CANCELED)"
                    }
                    if (item.DESCONEXAO === 480) {
                        item.DESCONEXAO =
                            "TEMPORARILY UNAVAILABLE (TEMPORARILY UNAVAILABLE)"
                    }
                    if (item.DESCONEXAO === 481) {
                        item.DESCONEXAO = "Call/Transaction Does Not Exist"
                    }
                    if (item.DESCONEXAO === 486) {
                        item.DESCONEXAO = "BUSY (BUSY)"
                    }
                    if (item.DESCONEXAO === 500) {
                        item.DESCONEXAO =
                            "SERVER INTERNAL ERROR (SERVER INTERNAL ERROR)"
                    }

                    return item
                })

                lista[i] = item
            }

            for (let i = 1; i < lista.length; i++) {
                const item = lista[i]

                let tipo = ""
                let status = ""
                let ramal = ""

                // item.forEach((log) => {
                //     console.log(log)
                // })

                // console.log(item)
                // process.exit(0)
                // console.log("")

                const atendida = item.find((item) => {
                    if (
                        item.STATUS === "ESTABLISHED" &&
                        item.DESCONEXAO === "NORMAL (BYE)" &&
                        (item.VCH_TO.includes("Usuario") ||
                            item.VCH_TO.includes("R41") ||
                            item.VCH_TO.includes("R50") ||
                            item.VCH_TO.includes("Gutierrez0"))
                    ) {
                        return true
                    }

                    if (
                        item.STATUS === "ESTABLISHED" &&
                        item.DESCONEXAO === "BYE (BYE)" &&
                        (item.VCH_TO.includes("Usuario") ||
                            item.VCH_TO.includes("R41") ||
                            item.VCH_TO.includes("R50") ||
                            item.VCH_TO.includes("Gutierrez0"))
                    ) {
                        return true
                    }

                    if (
                        item.STATUS === "ESTABLISHED" &&
                        item.DESCONEXAO === "UNDEFINED (UNDEFINED)" &&
                        (item.VCH_TO.includes("Usuario") ||
                            item.VCH_TO.includes("R41") ||
                            item.VCH_TO.includes("R50") ||
                            item.VCH_TO.includes("Gutierrez0"))
                    ) {
                        return true
                    }
                })

                if (atendida) {
                    status = "Atendida"
                    tipo = "Ramal"
                    ramal = atendida.VCH_TO
                    totais.atendida = totais.atendida + 1

                    console.log("Atendida")
                    console.log("Ramal")
                    console.log(totais.atendida)
                    console.log("")
                }

                if (!atendida) {
                    let tocou = item.filter((item) => {
                        if (
                            item.STATUS === "CANCELED" &&
                            item.DESCONEXAO === "CANCELED (CANCELED)" &&
                            (item.VCH_TO.includes("Usuario") ||
                                item.VCH_TO.includes("R41") ||
                                item.VCH_TO.includes("R50") ||
                                item.VCH_TO.includes("Gutierrez0"))
                        ) {
                            return true
                        }

                        if (
                            item.STATUS === "UNANSWERED" &&
                            item.DESCONEXAO === "UNANSWERED (CANCELED)" &&
                            (item.VCH_TO.includes("Usuario") ||
                                item.VCH_TO.includes("R41") ||
                                item.VCH_TO.includes("R50") ||
                                item.VCH_TO.includes("Gutierrez0"))
                        ) {
                            return true
                        }

                        if (
                            item.STATUS === "UNANSWERED" &&
                            item.DESCONEXAO === "TIMEOUT (CANCELED)" &&
                            (item.VCH_TO.includes("Usuario") ||
                                item.VCH_TO.includes("R41") ||
                                item.VCH_TO.includes("R50") ||
                                item.VCH_TO.includes("Gutierrez0"))
                        ) {
                            return true
                        }

                        return false
                    })

                    tocou = tocou.reduce((retorno, item, index) => {
                        if (index === tocou.length - 1) {
                            return (retorno += `${item.VCH_TO}(${
                                item.VCH_TARGET
                            }) ${parseInt(item.DURACAO)}`)
                        }
                        return (retorno += `${item.VCH_TO}(${
                            item.VCH_TARGET
                        }) ${parseInt(item.DURACAO)} - `)
                    }, "")

                    if (tocou) {
                        ramal = tocou
                        status = "Não Atendida"
                        tipo = "Ramal"
                        totais.nao_atendida = totais.nao_atendida + 1
                    }

                    if (!tocou) {
                        if (
                            item[item.length - 1].VCH_TO ===
                                item[item.length - 1].VCH_TARGET &&
                            item[item.length - 1].VCH_TO.includes("Noturn")
                        ) {
                            ramal = item[item.length - 1].VCH_TARGET
                            status = "Fora do Horário"
                            tipo = "Noturna"
                            totais.noturno = totais.noturno + 1
                        } else if (
                            item[item.length - 1].VCH_TO ===
                                item[item.length - 1].VCH_TARGET &&
                            item[item.length - 1].VCH_TO.includes("IVR")
                        ) {
                            ramal = item[item.length - 1].VCH_TARGET
                            status = "Desligou na URA"
                            tipo = "URA"
                            totais.desligou_ura = totais.desligou_ura + 1
                        } else if (
                            item[item.length - 1].VCH_TARGET.includes(
                                "Noturn"
                            ) &&
                            item[item.length - 1].STATUS === "ESTABLISHED" &&
                            item[item.length - 1].DESCONEXAO ===
                                "SERVER INTERNAL ERROR (SERVER INTERNAL ERROR)"
                        ) {
                            ramal = item[item.length - 1].VCH_TARGET
                            status = "Fora do Horário"
                            tipo = "Noturna"
                            totais.noturno = totais.noturno + 1
                        } else {
                            console.log(item)
                        }
                    }
                }

                planilha.push({
                    Originador: item[0].VCH_FROM,
                    Destino: item[0].VCH_TO,
                    Inicio: item[0].INICIO,
                    Termino: item[0].TERMINO,
                    Duracao: item[0].DURACAO,
                    Desconexão:
                        item[0].DESCONEXAO === "NORMAL (BYE)"
                            ? "Interna"
                            : "Externa",
                    Tipo: tipo,
                    ramal,
                    status
                })
            }

            planilhaTotais.push(totais)
            resolve([planilha, planilhaTotais])
        } catch (error) {
            reject(error)
        }
    })
}

// const getCdrFromDomain = (domain, dids, start, end) => {
//     return new Promise(async (resolve, reject) => {
//         try {
//             const conn = await require("../service/oracle-cloud").getConnection()

//             const query = `
//                 select
//                     distinct vch_callid
//                 from(
//                 select
//                     vch_callid
//                 from
//                     BASIXBRASTEL.tbl_pbx_systemcalllog cl,
//                     BASIXBRASTEL.tbl_sys_domain d
//                 where
//                     cl.int_domain_key = d.int_domain_key and
//                     d.vch_domain = '${domain}' and
//                     vch_to in (${dids.reduce(arrayToList, "")}) and
//                     dtm_starttime BETWEEN TO_DATE('${start}', 'DD-MM-YYYY HH24:MI:SS') and
//                     TO_DATE('${end}', 'DD-MM-YYYY HH24:MI:SS')
//                 order by
//                     dtm_starttime
//                 desc)`

//             let { rows } = await conn.execute(query)

//             rows = rows.map((item) => item.VCH_CALLID)
//             const lista = []

//             for (let i = 0; i < rows.length; i++) {
//                 const item = rows[i]

//                 const result = await conn.execute(`
//                     select
//                         int_connectionsequence,
//                         vch_from,
//                         vch_to,
//                         vch_target,
//                         vch_username,
//                         (((dtm_endtime) - (dtm_starttime)) * 24 * 60 * 60) as duracao,
//                         TO_CHAR(dtm_starttime,'DD-MM-YYYY HH24:MI:SS') as inicio,
//                         TO_CHAR(dtm_endtime,'DD-MM-YYYY HH24:MI:SS') as termino,
//                         int_status as status,
//                         --replace(int_status, 0, 'ESTABLISHED') as status,
//                         int_releasecause as desconexao
//                         -- replace(replace(replace(int_releasecause, 1, 'BYE (BYE)'), 6, 'TRANSFERED (BYE)'), 8 , 'NORMAL (BYE)') as desconexao
//                     from
//                         BASIXBRASTEL.tbl_pbx_systemcalllog
//                     where
//                         vch_callid = '${item}'
//                     order by
//                         int_connectionsequence
//                     `)

//                 lista.push(result.rows)
//                 console.log(`${i + 1} de ${rows.length}`)
//             }

//             conn.close()

//             const planilha = []
//             const totais = []
//             let quantidadeAtendida = 0
//             let quantidadeNAtendida = 0

//             for (let i = 0; i < lista.length; i++) {
//                 let item = lista[i]

//                 let originador = ""
//                 let destino = ""
//                 let desligadoPor = ""
//                 let atendida = ""
//                 let inicio = ""
//                 let termino = ""
//                 let ligacaoAtendida = "SIM"
//                 let naoAtendidaPor = ""
//                 let opcaoUra = ""

//                 originador = item[0].VCH_FROM
//                 destino = item[0].VCH_TO

//                 if (originador.length < 6 && item[0].VCH_TO === "*40") {
//                     originador = item[1].VCH_FROM
//                     destino = item[1].VCH_TO
//                 }

//                 if (/^sip:(.*)@(.*)$/.test(originador)) {
//                     originador = originador.match(/^sip:(.*)@(.*)$/)[1]
//                 }

//                 if (/^sip:(.*)@(.*)$/.test(destino)) {
//                     destino = destino.match(/^sip:(.*)@(.*)$/)[1]
//                 }

//                 inicio = item[0].INICIO
//                 termino = item[0].TERMINO

//                 item = item.map((item) => {
//                     if (item.STATUS === 0) {
//                         item.STATUS = "ESTABLISHED"
//                     }
//                     if (item.STATUS === 3) {
//                         item.STATUS = "UNANSWERED"
//                     }
//                     if (item.STATUS === 8) {
//                         item.STATUS = "CANCELED"
//                     }

//                     if (item.DESCONEXAO === 1) {
//                         item.DESCONEXAO = "BYE (BYE)"
//                     }
//                     if (item.DESCONEXAO === 2) {
//                         item.DESCONEXAO = "CANCELED (CANCELED)"
//                     }
//                     if (item.DESCONEXAO === 6) {
//                         item.DESCONEXAO = "TRANSFERED (BYE)"
//                     }
//                     if (item.DESCONEXAO === 8) {
//                         item.DESCONEXAO = "NORMAL (BYE)"
//                     }
//                     if (item.DESCONEXAO === 408) {
//                         item.DESCONEXAO = "TIMEOUT (CANCELED)"
//                     }
//                     if (item.DESCONEXAO === 481) {
//                         item.DESCONEXAO = "Call/Transaction Does Not Exist"
//                     }
//                     if (item.DESCONEXAO === 500) {
//                         item.DESCONEXAO =
//                             "SERVER INTERNAL ERROR (SERVER INTERNAL ERROR)"
//                     }

//                     return item
//                 })

//                 atendida = item
//                     .filter((item) => {
//                         if (
//                             item.STATUS === "ESTABLISHED" &&
//                             (item.VCH_TO.indexOf("usu") === 0 ||
//                                 item.VCH_TO.indexOf("R") === 0)
//                         ) {
//                             if (!opcaoUra) {
//                                 opcaoUra = item.VCH_TARGET
//                             }

//                             return item
//                         }
//                     })
//                     .map((item) => item.VCH_TO)
//                     .reduce((retorno, item, index, lista) => {
//                         if (index === 0) {
//                             return (retorno = `${item} `)
//                         }
//                         if (index === lista.length - 1) {
//                             return (retorno += `${item}`)
//                         }
//                         return (retorno += `${item} `)
//                     }, "")

//                 if (!atendida) {
//                     atendida = item.reduce((retorno, item) => {
//                         if (
//                             item.STATUS === "ESTABLISHED" &&
//                             item.VCH_TARGET.indexOf("IVR_Fora") === 0 &&
//                             item.INT_CONNECTIONSEQUENCE === 2
//                         ) {
//                             return (retorno = item.VCH_TARGET)
//                         }
//                         return retorno
//                     }, "")

//                     ligacaoAtendida = "Não"
//                 }

//                 const desligada = item.filter((item) => {
//                     if (item.DESCONEXAO === "BYE (BYE)") {
//                         return item
//                     }
//                 })

//                 if (desligada.length === 0) {
//                     desligadoPor = "Não identificado"
//                 } else {
//                     if (
//                         desligada[0].VCH_USERNAME ===
//                         "gateway@centrex.brastel.com.br"
//                     ) {
//                         desligadoPor = "Desligado Pelo Originador"
//                     }
//                 }

//                 if (
//                     item[0].STATUS === "ESTABLISHED" &&
//                     item[0].DESCONEXAO === "TIMEOUT (CANCELED)" &&
//                     item[0].INT_CONNECTIONSEQUENCE === 1
//                 ) {
//                     desligadoPor = "Ramais não atenderam"

//                     naoAtendidaPor = item.reduce((retorno, item, index) => {
//                         if (
//                             !(
//                                 item.VCH_TO.indexOf("usu") === 0 ||
//                                 item.VCH_TO.indexOf("R") === 0
//                             )
//                         ) {
//                             return retorno
//                         }

//                         const start = moment(item.INICIO, "DD-MM-YYYY HH:mm:ss")
//                         const end = moment(item.TERMINO, "DD-MM-YYYY HH:mm:ss")
//                         const duracao = moment.duration(end.diff(start))
//                         const duracaoRing = duracao.as("seconds")

//                         opcaoUra = item.VCH_TARGET

//                         if (index === 0 && lista.length - 1) {
//                             return (retorno += `${item.VCH_TO} - ${duracaoRing}`)
//                         }

//                         if (index === lista.length - 1) {
//                             return (retorno += `${item.VCH_TO} - ${duracaoRing}`)
//                         } else {
//                             return (retorno += `${item.VCH_TO} - ${duracaoRing}, `)
//                         }
//                     }, "")
//                 }

//                 if (
//                     desligadoPor === "Desligado Pelo Originador" &&
//                     !naoAtendidaPor &&
//                     !opcaoUra &&
//                     !atendida &&
//                     item.length === 2
//                 ) {
//                     desligadoPor = `${desligadoPor} - ${
//                         item[item.length - 1].VCH_TO
//                     }`
//                 }

//                 if (
//                     desligadoPor === "Desligado Pelo Originador" &&
//                     !naoAtendidaPor &&
//                     !opcaoUra &&
//                     !atendida
//                 ) {
//                     opcaoUra = item[item.length - 1].VCH_TARGET

//                     const start = moment(
//                         item[item.length - 1].INICIO,
//                         "DD-MM-YYYY HH:mm:ss"
//                     )
//                     const end = moment(
//                         item[item.length - 1].TERMINO,
//                         "DD-MM-YYYY HH:mm:ss"
//                     )
//                     const duracao = moment.duration(end.diff(start))
//                     const duracaoRing = duracao.as("seconds")

//                     naoAtendidaPor = `${
//                         item[item.length - 1].VCH_TO
//                     } - ${duracaoRing}`
//                     // desligadoPor = `${desligadoPor} - ${item[item.length - 1].VCH_TO}`
//                 }

//                 if (!desligadoPor) {
//                     desligadoPor = desligada[desligada.length - 1].VCH_TO
//                     if (desligada[desligada.length - 1].VCH_TO === "*40") {
//                         desligadoPor = `${item[0].VCH_FROM} puxou a ligação`
//                         ligacaoAtendida = "SIM"
//                     }
//                 }

//                 if (
//                     desligadoPor === "Não identificado" &&
//                     !naoAtendidaPor &&
//                     !opcaoUra &&
//                     !atendida &&
//                     item[0].DESCONEXAO ===
//                         "SERVER INTERNAL ERROR (SERVER INTERNAL ERROR)"
//                 ) {
//                     desligadoPor = "Indeterminado"
//                 }

//                 if (ligacaoAtendida === "SIM") {
//                     quantidadeAtendida++
//                 } else {
//                     quantidadeNAtendida++
//                 }

//                 planilha.push({
//                     Originador: originador,
//                     Destino: destino,
//                     Inicio: inicio,
//                     Termino: termino,
//                     DesligadoPor: desligadoPor,
//                     naoAtendidaPor,
//                     opcaoUra,
//                     AtendidaPor: atendida,
//                     Atendida: ligacaoAtendida
//                 })
//             }

//             totais.push({
//                 Atendidas: quantidadeAtendida,
//                 "Não Atendidas": quantidadeNAtendida
//             })

//             planilha.sort((a, b) => {
//                 if (a.Inicio < b.Inicio) {
//                     return -1
//                 }
//                 if (a.Inicio > b.Inicio) {
//                     return 1
//                 }
//                 return 0
//             })

//             resolve([planilha, totais])
//         } catch (error) {
//             reject(error)
//         }
//     })
// }

const getCdrFromDomainCallCenter = (domain, dids, start, end) => {
    return new Promise(async (resolve, reject) => {
        try {
            const conn = await require("../service/oracle-cloud").getConnection()

            const query = `
                select
                    distinct vch_callid
                from(
                select
                    vch_callid
                from
                    BASIXBRASTEL.tbl_pbx_systemcalllog cl,
                    BASIXBRASTEL.tbl_sys_domain d
                where
                    cl.int_domain_key = d.int_domain_key and
                    d.vch_domain = '${domain}' and
                    vch_to in (${dids.reduce(arrayToList, "")}) and
                    dtm_starttime BETWEEN TO_DATE('${start}', 'DD-MM-YYYY HH24:MI:SS') and
                    TO_DATE('${end}', 'DD-MM-YYYY HH24:MI:SS')
                order by
                    dtm_starttime
                desc)`

            let { rows } = await conn.execute(query)

            rows = rows.map((item) => item.VCH_CALLID)
            const lista = []

            for (let i = 0; i < rows.length; i++) {
                const item = rows[i]

                const result = await conn.execute(`
                    select
                        int_connectionsequence,
                        vch_from,
                        vch_to,
                        vch_target,
                        vch_username,
                        (((dtm_endtime) - (dtm_starttime)) * 24 * 60 * 60) as duracao,
                        TO_CHAR(dtm_starttime,'DD-MM-YYYY HH24:MI:SS') as inicio,
                        TO_CHAR(dtm_endtime,'DD-MM-YYYY HH24:MI:SS') as termino,
                        int_status as status,
                        --replace(int_status, 0, 'ESTABLISHED') as status,
                        int_releasecause as desconexao
                        -- replace(replace(replace(int_releasecause, 1, 'BYE (BYE)'), 6, 'TRANSFERED (BYE)'), 8 , 'NORMAL (BYE)') as desconexao
                    from
                        BASIXBRASTEL.tbl_pbx_systemcalllog
                    where
                        vch_callid = '${item}'
                    order by
                        int_connectionsequence
                    `)

                lista.push(result.rows)
                console.log(`${i + 1} de ${rows.length}`)
            }

            const planilha = []
            const planilhaTotais = []
            const totais = {
                callcenter: 0,
                callcenter_nao_respondido: 0,
                callcenter_timeout: 0,
                callcenter_desligou_na_conexao: 0,
                origem_busy: 0,
                desligou_ura: 0,
                ura_nao_selecionou: 0,
                ura_desligou_antes_iniciar: 0,
                noturno: 0
            }

            for (let i = 0; i < lista.length; i++) {
                let item = lista[i]

                item = item.map((item) => {
                    if (item.STATUS === 0) {
                        item.STATUS = "ESTABLISHED"
                    }
                    if (item.STATUS === 3) {
                        item.STATUS = "UNANSWERED"
                    }
                    if (item.STATUS === 4) {
                        item.STATUS = "BUSY"
                    }
                    if (item.STATUS === 8) {
                        item.STATUS = "CANCELED"
                    }
                    if (item.STATUS === 99) {
                        item.STATUS = "UNDEFINED"
                    }

                    if (item.DESCONEXAO === 1) {
                        item.DESCONEXAO = "BYE (BYE)"
                    }
                    if (item.DESCONEXAO === 2) {
                        item.DESCONEXAO = "CANCELED (CANCELED)"
                    }
                    if (item.DESCONEXAO === 6) {
                        item.DESCONEXAO = "TRANSFERED (BYE)"
                    }
                    if (item.DESCONEXAO === 8) {
                        item.DESCONEXAO = "NORMAL (BYE)"
                    }
                    if (item.DESCONEXAO === 99) {
                        item.DESCONEXAO = "UNDEFINED (UNDEFINED)"
                    }
                    if (item.DESCONEXAO === 408) {
                        item.DESCONEXAO = "TIMEOUT (CANCELED)"
                    }
                    if (item.DESCONEXAO === 480) {
                        item.DESCONEXAO =
                            "TEMPORARILY UNAVAILABLE (TEMPORARILY UNAVAILABLE)"
                    }
                    if (item.DESCONEXAO === 481) {
                        item.DESCONEXAO = "Call/Transaction Does Not Exist"
                    }
                    if (item.DESCONEXAO === 486) {
                        item.DESCONEXAO = "BUSY (BUSY)"
                    }
                    if (item.DESCONEXAO === 500) {
                        item.DESCONEXAO =
                            "SERVER INTERNAL ERROR (SERVER INTERNAL ERROR)"
                    }

                    return item
                })

                lista[i] = item
            }

            for (let i = 0; i < lista.length; i++) {
                const item = lista[i]
                let tipo = ""
                let callcenter = ""
                let status = ""
                let operador = ""
                let nota = ""
                let callcenterStatus = ""

                if (
                    item[item.length - 1].VCH_TO === "acdGroupServer" &&
                    item[item.length - 1].STATUS === "ESTABLISHED"
                ) {
                    totais.callcenter = totais.callcenter + 1
                    tipo = "CallCenter"
                    callcenter = item[item.length - 1].VCH_TARGET
                    status = "Conectada"

                    let horaInicio = moment(
                        item[0].INICIO,
                        "DD-MM-YYYY HH:mm:ss"
                    )
                    horaInicio = horaInicio.add(-1, "minute")
                    horaInicio = horaInicio.format("DD-MM-YYYY HH:mm:ss")

                    let horaTermino = moment(
                        item[0].TERMINO,
                        "DD-MM-YYYY HH:mm:ss"
                    )
                    horaTermino = horaTermino.add(1, "minute")
                    horaTermino = horaTermino.format("DD-MM-YYYY HH:mm:ss")

                    const callcenterData = await conn.execute(`
                        select
                            *
                        from
                            tbl_callcenter_calllog
                        where
                            vch_from = '${item[0].VCH_FROM}' and
                            vch_to = '${item[item.length - 1].VCH_TARGET}' and
                            dtm_start between TO_DATE('${horaInicio}','DD-MM-YYYY HH24:MI:SS') and TO_DATE('${horaTermino}','DD-MM-YYYY HH24:MI:SS') and
                            dtm_end between TO_DATE('${horaInicio}','DD-MM-YYYY HH24:MI:SS') and TO_DATE('${horaTermino}','DD-MM-YYYY HH24:MI:SS')
                    `)

                    if (callcenterData.rows.length > 0) {
                        operador = callcenterData.rows[0].VCH_USERNAMEPA
                        nota = callcenterData.rows[0].INT_SURVEYRANKING

                        if (callcenterData.rows[0].INT_CALLSUCCESS === 0) {
                            callcenterStatus = "Estabelecida"
                        } else if (
                            callcenterData.rows[0].INT_CALLSUCCESS === 1
                        ) {
                            callcenterStatus = "Desconectada pelo originador"
                        } else if (
                            callcenterData.rows[0].INT_CALLSUCCESS === 3
                        ) {
                            callcenterStatus = "Abandonada na fila"
                        } else if (
                            callcenterData.rows[0].INT_CALLSUCCESS === 6
                        ) {
                            callcenterStatus = "Pesquisa concluida"
                        } else if (
                            callcenterData.rows[0].INT_CALLSUCCESS === 7
                        ) {
                            callcenterStatus = "Abandonada na pesquisa"
                        } else {
                            callcenterStatus =
                                callcenterData.rows[0].INT_CALLSUCCESS
                        }
                    } else {
                        const basixCalllogData = await conn.execute(`
                            select
                                u.vch_username
                            from
                                tbl_pbx_calllog cl,
                                tbl_pbx_pbxuser pu,
                                tbl_sys_user u
                            where
                                cl.dtm_from_date between TO_DATE('${horaInicio}','DD-MM-YYYY HH24:MI:SS') and TO_DATE('${horaTermino}','DD-MM-YYYY HH24:MI:SS') and
                                cl.dtm_until_date between TO_DATE('${horaInicio}','DD-MM-YYYY HH24:MI:SS') and TO_DATE('${horaTermino}','DD-MM-YYYY HH24:MI:SS') and
                                cl.vch_display = '${item[0].VCH_FROM}' and
                                cl.int_pbxuser_key = pu.int_pbxuser_key and
                                pu.int_user_key = u.int_user_key and
                                cl.vch_myaddress = u.vch_username
                            `)

                        if (basixCalllogData.rows.length > 0) {
                            operador = basixCalllogData.rows[0].VCH_USERNAME
                        }
                    }
                } else if (
                    item[item.length - 1].DESCONEXAO === "NORMAL (BYE)" &&
                    item[item.length - 1].VCH_TO ===
                        item[item.length - 1].VCH_TARGET &&
                    item[0].DESCONEXAO === "BYE (BYE)"
                ) {
                    if (item[item.length - 1].VCH_TO === "IVR_Fora") {
                        totais.noturno = totais.noturno + 1
                        tipo = "Noturna"
                        status = "Fora do horário"
                    } else {
                        totais.desligou_ura = totais.desligou_ura + 1
                        tipo = "URA"
                        status = "Desligou na URA"
                    }
                } else if (
                    item[0].DESCONEXAO === "BYE (BYE)" &&
                    item[item.length - 1].VCH_TO === "acdGroupServer" &&
                    item[item.length - 1].STATUS === "CANCELED" &&
                    item[item.length - 1].DESCONEXAO === "CANCELED (CANCELED)"
                ) {
                    totais.callcenter_desligou_na_conexao =
                        totais.callcenter_desligou_na_conexao + 1
                    tipo = "CallCenter"
                    callcenter = item[item.length - 1].VCH_TARGET
                    status = "Desligada antes de conectar no callcenter"
                } else if (
                    item[item.length - 1].VCH_TO === "IVR_Fora" &&
                    item[item.length - 1].VCH_TARGET === "IVR_Fora"
                ) {
                    totais.noturno = totais.noturno + 1
                    tipo = "Noturna"
                    status = "Fora do horário"
                } else if (
                    item[item.length - 1].VCH_TO === "acdGroupServer" &&
                    item[item.length - 1].STATUS === "BUSY" &&
                    item[item.length - 1].DESCONEXAO ===
                        "TEMPORARILY UNAVAILABLE (TEMPORARILY UNAVAILABLE)" &&
                    item[0].DESCONEXAO === "NORMAL (BYE)"
                ) {
                    totais.callcenter_nao_respondido =
                        totais.callcenter_nao_respondido + 1
                    tipo = "CallCenter"
                    callcenter = item[item.length - 1].VCH_TARGET
                    status = "Não Respondido"
                } else if (
                    item[item.length - 1].VCH_TO === "acdGroupServer" &&
                    item[item.length - 1].STATUS === "UNANSWERED" &&
                    item[item.length - 1].DESCONEXAO === "TIMEOUT (CANCELED)" &&
                    item[0].STATUS === "ESTABLISHED" &&
                    item[0].DESCONEXAO === "TIMEOUT (CANCELED)"
                ) {
                    totais.callcenter_timeout = totais.callcenter_timeout + 1
                    tipo = "CallCenter"
                    callcenter = item[item.length - 1].VCH_TARGET
                    status = "TIMEOUT"
                } else if (
                    item[0].STATUS === "ESTABLISHED" &&
                    item[0].DESCONEXAO === "BUSY (BUSY)" &&
                    item[item.length - 1].STATUS === "ESTABLISHED" &&
                    item[item.length - 1].DESCONEXAO === "NORMAL (BYE)"
                ) {
                    totais.origem_busy = totais.origem_busy + 1
                    tipo = "URA"
                    status = "BUSY da Origem - Erro de sinalização"
                } else if (
                    item[0].STATUS === "ESTABLISHED" &&
                    item[0].DESCONEXAO === "NORMAL (BYE)" &&
                    item[item.length - 1].STATUS === "ESTABLISHED" &&
                    item[item.length - 1].DESCONEXAO === "BYE (BYE)" &&
                    item[item.length - 1].VCH_TARGET === "IVR_Inicio"
                ) {
                    totais.ura_nao_selecionou = totais.ura_nao_selecionou + 1
                    tipo = "URA"
                    status = "Não selecionou opção"
                } else if (
                    item[0].STATUS === "CANCELED" &&
                    item[0].DESCONEXAO === "CANCELED (CANCELED)" &&
                    item[item.length - 1].STATUS === "ESTABLISHED" &&
                    item[item.length - 1].DESCONEXAO === "NORMAL (BYE)" &&
                    item[item.length - 1].VCH_TARGET === "IVR_Inicio"
                ) {
                    totais.ura_desligou_antes_iniciar =
                        totais.ura_desligou_antes_iniciar + 1
                    tipo = "URA"
                    status =
                        "Originador desligou antes de começar a tocar o prompt"
                } else if (
                    item[0].STATUS === "ESTABLISHED" &&
                    item[0].DESCONEXAO ===
                        "SERVER INTERNAL ERROR (SERVER INTERNAL ERROR)" &&
                    item.length === 1 &&
                    item[0].VCH_TARGET === "IVR_Fora"
                ) {
                    totais.noturno = totais.noturno + 1
                    tipo = "URA"
                    status = "Fora do horário"
                } else if (
                    item[0].STATUS === "ESTABLISHED" &&
                    item[0].DESCONEXAO ===
                        "SERVER INTERNAL ERROR (SERVER INTERNAL ERROR)" &&
                    item[item.length - 1].STATUS === "UNDEFINED" &&
                    item[item.length - 1].DESCONEXAO ===
                        "UNDEFINED (UNDEFINED)" &&
                    item[item.length - 1].VCH_TO === "acdGroupServer" &&
                    item[item.length - 1].DURACAO === 36000
                ) {
                    totais.callcenter_desligou_na_conexao =
                        totais.callcenter_desligou_na_conexao + 1
                    tipo = "CallCenter"
                    callcenter = item[item.length - 1].VCH_TARGET
                    status = "Desligada na transferencia para o CallCenter"
                } else {
                    console.log(`Duração: ${parseInt(item[0].DURACAO)}`)
                    console.log(`From: ${item[0].VCH_FROM}`)
                    console.log(`To: ${item[0].VCH_TO}`)
                    console.log(`Inicio: ${item[0].INICIO}`)
                    console.log(`Termino: ${item[0].TERMINO}`)

                    console.log(item)
                }

                planilha.push({
                    Originador: item[0].VCH_FROM,
                    Destino: item[0].VCH_TO,
                    Inicio: item[0].INICIO,
                    Termino: item[0].TERMINO,
                    Duracao: item[0].DURACAO,
                    Desconexão:
                        item[0].DESCONEXAO === "NORMAL (BYE)"
                            ? "Interna"
                            : "Externa",
                    Tipo: tipo,
                    CallCenter: callcenter,
                    Status: status,
                    Operador: operador,
                    Nota: nota,
                    "Status CallCenter": callcenterStatus
                })
            }

            planilhaTotais.push(totais)

            resolve([planilha, planilhaTotais])
        } catch (error) {
            reject(error)
        }
    })
}

module.exports = {
    getCdr,
    getCdrFromDomain,
    getCdrFromDomainCallCenter,
    arrayToList,
    getDetalhesDiaChamadasDiscadas
}
