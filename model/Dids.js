const getDidsFromDomain = ({ domain }) => {
  return new Promise(async (resolve, reject) => {
    try {
      const conn = await require('../service/oracle-cloud').getConnection()

      let { rows } = await conn.execute(`
        select
            a.vch_address as did,
            a.txt_description as descricao,
            u.vch_username as usuario,
            u.vch_name as nome,
            g.vch_name as grupo,
            da.vch_address as endereco
        from
            BASIXBRASTEL.tbl_pbx_address a
            FULL OUTER JOIN BASIXBRASTEL.tbl_pbx_pbxuser pu
                ON a.int_pbxuser_key = pu.int_pbxuser_key
            FULL OUTER JOIN BASIXBRASTEL.tbl_sys_user u
                ON pu.int_user_key = u.int_user_key
            FULL OUTER JOIN BASIXBRASTEL.tbl_pbx_group g
                ON a.int_group_key = g.int_group_key
            FULL OUTER JOIN BASIXBRASTEL.tbl_pbx_pbx p
                ON a.int_pbx_key = p.int_pbx_key
            FULL OUTER JOIN BASIXBRASTEL.tbl_pbx_address da
                ON p.int_defaultaddress_key = da.int_address_key,
            BASIXBRASTEL.tbl_sys_domain d
        where
            a.int_domain_key = d.int_domain_key and
            d.vch_domain = '${domain}' and
            a.int_type = 3 and
            a.int_active = 1 and
        a.vch_address not like '55119%'
      `)
      conn.close()

      rows = rows.map(item => {
        if (item.USUARIO) {
          return {
            DID: item.DID,
            DESCRICAO: item.DESCRICAO,
            DESTINO: `${item.USUARIO} - ${item.NOME}`
          }
        }

        return {
          DID: item.DID,
          DESCRICAO: item.DESCRICAO,
          DESTINO: item.GRUPO || item.ENDERECO || 'Operador Padrão'
        }
      })

      resolve(rows)
    } catch (error) {
      reject(error)
    }
  })
}

module.exports = {
  getDidsFromDomain
}
