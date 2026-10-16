import { BaseApp } from '@zeppos/zml/base-app'
import { log as Logger } from '@zos/utils'

const logger = Logger.getLogger('rail-sync')

App(
  BaseApp({
    globalData: {},
    onCreate() {
      logger.log('app onCreate')
    },
    onDestroy() {
      logger.log('app onDestroy')
    }
  })
)
