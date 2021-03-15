const callcenterRelatorioPADiario = ({ dominio, inicio, termino }) => {
    return new Promise(async (resolve, reject) => {
        try {
            const conn = await require("../service/oracle-cloud").getConnection()

            const { rows } = await conn.execute(`
            select
                u.vch_username,
                u.vch_name,
                g.vch_name as grupo,
                par.*,
                TO_CHAR(par.dtm_start_date , 'DD-MM-YYYY HH24:MI:SS') as inicio,
                TO_CHAR(par.dtm_end_date, 'DD-MM-YYYY HH24:MI:SS') as termino
            from
                tbl_callcenter_pareport par,
                tbl_pbx_pbxuser pu,
                tbl_sys_user u,
                tbl_sys_domain d,
                tbl_pbx_group g
            where
                d.int_domain_key = u.int_domain_key and
                u.int_user_key = pu.int_user_key and
                pu.int_pbxuser_key = par.int_pbxuser_key and
                par.int_group_key = g.int_group_key and
                d.vch_domain = '${dominio}' and
                par.dtm_start_date between TO_DATE('${inicio}','DD-MM-YYYY HH24:MI:SS') and TO_DATE('${termino}','DD-MM-YYYY HH24:MI:SS') and
                par.int_type = 2
        `)

            console.log(rows[0])

            const porGrupos = rows.map((item) => {
                return {
                    grupo: item.GRUPO,
                    nome: item.VCH_NAME,
                    //   ofertadas: item.INT_INBOUND,
                    atendidas: item.INT_ESTABLISHEDCALLS,
                    //   desligadas: item.INT_FINALIZEDCALLS,
                    abandonadas: item.INT_ABANDONED,
                    discadas: item.INT_OUTBOUND,
                    //   discadasDesligadas: item.INT_FINALIZEDOUTBOUNDCALLS,
                    internas: item.INT_CALLSTOEXTENSION,
                    //   internasDesligadas: item.INT_FINALIZEDCALLSTOEXTENSION.GRUPO,
                    totalEmPesquisa:
                        item.INT_SURVEYRANKING + item.INT_SURVEYABANDONED,
                    emPesquisa: item.INT_SURVEYRANKING,
                    abandonadasEmPesquisa: item.INT_SURVEYABANDONED,
                    mediaNota: item.INT_SURVEYRANKINGVALUE,
                    //   call: item.INT_CALLS,
                    //   refused: item.INT_REFUSED,
                    //   answered: item.INT_ANSWERED,
                    //   answeredActiveCalls: item.INT_ANSWEREDACTIVECALLS,
                    //   tranfered: item.INT_TRANSFERED,
                    porcentagemAtendimento: item.INT_ESTABLISHEDCALLSPERCENT,
                    tma: item.INT_TMA,
                    tempoEmPausa: item.INT_PAUSEDTIME,
                    tempoLivre: item.INT_FREETIME,
                    tempoChamadaDiscada: item.INT_OUTBOUNDCALLTIME,
                    tempoEmChamada: item.INT_MAXTIMEINCALL,
                    tempoMaximoEmChamada: item.INT_MAXTIMEINACTIVECALL,
                    inicio: item.INICIO,
                    termino: item.TERMINO
                }
            })

            resolve(porGrupos)
        } catch (error) {
            reject(error)
        }
    })
}

module.exports = {
    callcenterRelatorioPADiario
}
