const getGroupsFromDomain = ({ domain }) => {
    return new Promise(async (resolve, reject) => {
        try {
            const conn = await require("../service/oracle-cloud").getConnection()

            const { rows: grupos } = await conn.execute(`
        select
            g.int_group_key,
            g.vch_name as nome,
            g.txt_description as descricao,
            replace(replace(replace(replace(replace(g.int_grouptype, 0, 'Toque'), 1, 'Busca'), 2, 'ACD'), 3, 'CallCenter'), 4, 'SIPTrunk') as tipo,
            c.int_timeoutcall as tempo_chamando,
            g.int_maxdistributiontime as tempo_maximo,
            replace(replace(replace(g.int_algorithmtype, -1, ''), 0, 'Tempo Maximo Ocioso'), 1, 'Sequencial') as distribuicao
        from
            BASIXBRASTEL.tbl_pbx_group g,
            BASIXBRASTEL.tbl_pbx_config c,
            BASIXBRASTEL.tbl_pbx_pbx pb,
            BASIXBRASTEL.tbl_sys_user u,
            BASIXBRASTEL.tbl_sys_domain d
        where
            g.int_config_key = c.int_config_key and
            g.int_pbx_key = pb.int_pbx_key and
            pb.int_user_key = u.int_user_key and
            u.int_domain_key = d.int_domain_key and
            d.vch_domain = '${domain}' and
            g.int_active = 1
      `)

            for (let i = 0; i < grupos.length; i++) {
                const item = grupos[i]

                const { rows: usuarios } = await conn.execute(`
        select
            u.vch_username as usuario,
            ug.int_priority as prioridade
        from
            BASIXBRASTEL.tbl_pbx_usergroup ug,
            BASIXBRASTEL.tbl_pbx_pbxuser pu,
            BASIXBRASTEL.tbl_sys_user u
        where
            ug.int_group_key = ${item.INT_GROUP_KEY} and
            ug.int_pbxuser_key = pu.int_pbxuser_key and
            pu.int_user_key = u.int_user_key
        `)

                if (item.TIPO === "Toque") {
                    item.USUARIOS = usuarios.reduce(
                        (string, item, index, array) => {
                            if (array.length - 1 === index) {
                                return (string += item.USUARIO)
                            }
                            return (string += `${item.USUARIO} `)
                        },
                        ""
                    )
                } else {
                    item.USUARIOS = usuarios.reduce(
                        (string, item, index, array) => {
                            if (array.length - 1 === index) {
                                return (string += `${item.USUARIO} - ${item.PRIORIDADE}`)
                            }
                            return (string += `${item.USUARIO} - ${item.PRIORIDADE} `)
                        },
                        ""
                    )
                }

                delete item.INT_GROUP_KEY
                grupos[i] = item
            }
            conn.close()

            resolve(grupos)
        } catch (error) {
            reject(error)
        }
    })
}

module.exports = {
    getGroupsFromDomain
}
