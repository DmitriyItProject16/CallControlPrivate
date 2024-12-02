import * as React from 'react'
import { createRoot } from 'react-dom/client';
import { ControlCleanupCallback, ILoaderArgs, IRemoteComponentCardApi } from '@directum/sungero-remote-component-types';

import CallControl from '../controls/call/call-control';

/**
 * Загрузчик контрола для совершения исходящих звонков
 * @param args Аргументы загрузчика.
 */
export default (args: ILoaderArgs): Promise<ControlCleanupCallback> => {
    console.log("call-control-loader");
    const root = createRoot(args.container);
    root.render(<CallControl initialContext={args.initialContext} api={args.api as IRemoteComponentCardApi}/>);
    return Promise.resolve(() => root.unmount());
  };