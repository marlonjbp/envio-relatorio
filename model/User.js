const getUsersFromDomain = ({ domain }) => {
  return new Promise(async (resolve, reject) => {
    try {
      const conn = await require('../service/oracle-cloud').getConnection()

      const { rows } = await conn.execute(`
        select
            u.int_user_key as user_key,
            u.VCH_USERNAME as usuario,
            u.vch_name as nome,
            s.vch_name as classe_de_servico,
            r.vch_address as ramal,
            replace(replace(pu.int_isanonymous, 1, 'Sim'), 0, 'Não') as anonymous,
            a.VCH_ADDRESS as DID,
            replace(replace(c.int_allowedrecordcall, 1, 'Sim'), 0, 'Não') as grava
        from
            BASIXBRASTEL.tbl_sys_domain d,
            BASIXBRASTEL.tbl_pbx_serviceclass s,
            BASIXBRASTEL.tbl_pbx_config c,
            basixbrastel.TBL_SYS_USER u,
            basixbrastel.tbl_pbx_pbxuser pu
            FULL OUTER JOIN BASIXBRASTEL.tbl_pbx_address r
                ON pu.int_pbxuser_key = r.int_pbxuser_key and r.int_type = 1
            FULL OUTER JOIN basixbrastel.TBL_PBX_ADDRESS a
                ON pu.int_defaultdid_key = a.int_address_key
        where
            pu.int_user_key = u.int_user_key and
            u.int_domain_key = d.int_domain_key and
            pu.int_serviceclass_key = s.int_serviceclass_key and
            pu.int_config_key = c.int_config_key and
            d.vch_domain = '${domain}' and
            u.int_agentuser = 0 and
            u.int_active = 1 and
            u.VCH_USERNAME != 'administrator' and
            s.vch_name != 'Cancelado' and
            s.vch_name != 'B_Total' and
            u.vch_name not like '%URA%'
        order by
            u.VCH_USERNAME
        asc
      `)

      for (let i = 0; i < rows.length; i++) {
        const item = rows[i]

        const retorno = await conn.execute(`
          select
              TO_CHAR(dtm_sessionlastuse,'DD-MM-YYYY HH24:MI:SS') as online_ultimo
          from
              (select
                  sl.*,
                  row_number() over (order by sl.dtm_sessionlastuse desc) as line_number
              from
                  BASIXBRASTEL.tbl_sys_sessionlog sl
                  FULL OUTER JOIN BASIXBRASTEL.tbl_sys_sipsessionlog ssl
                      ON sl.int_sessionlog_key = ssl.int_sessionlog_key
              where
                  sl.int_user_key = ${item.USER_KEY})
          where
              line_number = 1
        `)

        if (retorno.rows[0]) {
          item.ULTIMA_SESSAO = retorno.rows[0].ONLINE_ULTIMO
        } else {
          item.ULTIMA_SESSAO = ''
        }

        delete item.USER_KEY
        rows[i] = item
      }

      conn.close()

      resolve(rows)
    } catch (error) {
      reject(error)
    }
  })
}

const getTerminaisFromDomain = ({ domain }) => {
  return new Promise(async (resolve, reject) => {
    try {
      const conn = await require('../service/oracle-cloud').getConnection()

      const { rows } = await conn.execute(`
        select
            u.int_user_key as user_key,
            u.vch_username as terminal,
            u2.vch_username as ramal
        from
            basixbrastel.tbl_pbx_pbxuser pu,
            BASIXBRASTEL.tbl_sys_user u,
            BASIXBRASTEL.tbl_sys_domain d,
            BASIXBRASTEL.tbl_pbx_terminal t
            FULL OUTER JOIN BASIXBRASTEL.tbl_pbx_pbxuserterminal ut
                ON t.int_terminal_key = ut.int_terminal_key
            FULL OUTER JOIN basixbrastel.tbl_pbx_pbxuser pu2
                ON ut.int_pbxuser_key = pu2.int_pbxuser_key
            FULL OUTER JOIN BASIXBRASTEL.tbl_sys_user u2
                ON pu2.int_user_key = u2.int_user_key
        where
            pu.int_user_key = u.int_user_key and
            u.int_domain_key = d.int_domain_key and
            t.int_pbxuser_key = pu.int_pbxuser_key and
            d.vch_domain = '${domain}' and
            u.int_agentuser = 7 and
            t.int_active = 1
        order by
            u.vch_username
      `)

      for (let i = 0; i < rows.length; i++) {
        const item = rows[i]

        const retorno = await conn.execute(`
          select
              TO_CHAR(dtm_sessionlastuse,'DD-MM-YYYY HH24:MI:SS') as online_ultimo
          from
              (select
                  sl.*,
                  row_number() over (order by sl.dtm_sessionlastuse desc) as line_number
              from
                  BASIXBRASTEL.tbl_sys_sessionlog sl
                  FULL OUTER JOIN BASIXBRASTEL.tbl_sys_sipsessionlog ssl
                      ON sl.int_sessionlog_key = ssl.int_sessionlog_key
              where
                  sl.int_user_key = ${item.USER_KEY})
          where
              line_number = 1
        `)

        if (retorno.rows[0]) {
          item.ULTIMA_SESSAO = retorno.rows[0].ONLINE_ULTIMO
        } else {
          item.ULTIMA_SESSAO = ''
        }

        delete item.USER_KEY
        rows[i] = item
      }

      conn.close()

      resolve(rows)
    } catch (error) {
      reject(error)
    }
  })
}

module.exports = {
  getUsersFromDomain,
  getTerminaisFromDomain
}
