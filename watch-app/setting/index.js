AppSettingsPage({
  state: {
    props: {}
  },
  build(props) {
    this.state.props = props
    const { settingsStorage } = props
    const pairCode = settingsStorage.getItem('pairCode') || ''
    const serverUrl = settingsStorage.getItem('serverUrl') || 'http://127.0.0.1:8787'
    const syncStatus = settingsStorage.getItem('syncStatus') || '尚未同步'
    const hasToken = !!(settingsStorage.getItem('pairToken') || '')

    return View(
      {
        style: {
          padding: '16px 20px',
          fontFamily: 'system-ui, sans-serif'
        }
      },
      [
        Text({
          style: { fontSize: '18px', fontWeight: '700', marginBottom: '8px' }
        }, ['高铁行程设置']),
        Text({
          style: { fontSize: '13px', color: '#666', marginBottom: '16px', lineHeight: '1.4' }
        }, [
          '在手机网页完成截图导入后，把配对码填到这里。Side Service 会在手表刷新时拉取行程。'
        ]),
        Text({
          style: { fontSize: '13px', marginBottom: '6px' }
        }, ['配对码（6 位）']),
        TextInput({
          label: '',
          value: pairCode,
          placeholder: '例如 483920',
          maxLength: 6,
          onChange: (val) => {
            const code = String(val || '').replace(/\D/g, '').slice(0, 6)
            settingsStorage.setItem('pairCode', code)
            settingsStorage.setItem('pairToken', '')
          }
        }),
        Text({
          style: {
            fontSize: '12px',
            color: hasToken ? '#2bb0a6' : '#999',
            margin: '8px 0 16px'
          }
        }, [hasToken ? '已绑定同步令牌' : '尚未绑定，手表刷新时自动兑换']),
        Text({
          style: { fontSize: '13px', marginBottom: '6px' }
        }, ['同步服务地址']),
        TextInput({
          label: '',
          value: serverUrl,
          placeholder: 'http://192.168.x.x:8787',
          onChange: (val) => {
            settingsStorage.setItem('serverUrl', String(val || '').trim())
          }
        }),
        Text({
          style: { fontSize: '12px', color: '#999', marginTop: '8px', marginBottom: '16px' }
        }, ['手机与手表经 Zepp 联网访问。请填电脑局域网 IP，不要用 localhost（手表侧走手机网络）。']),
        Text({
          style: { fontSize: '13px', marginBottom: '6px' }
        }, ['状态']),
        Text({
          style: {
            fontSize: '13px',
            padding: '10px',
            background: '#f5f7fa',
            borderRadius: '8px',
            lineHeight: '1.4'
          }
        }, [syncStatus]),
        Button({
          label: '清除本地绑定',
          style: {
            marginTop: '16px',
            background: '#d86b5a',
            color: '#fff',
            borderRadius: '8px',
            padding: '10px'
          },
          onClick: () => {
            settingsStorage.setItem('pairToken', '')
            settingsStorage.setItem('pairCode', '')
            settingsStorage.setItem('syncStatus', '已清除绑定')
          }
        })
      ]
    )
  }
})
