import React from 'react';
import { IRemoteComponentCardApi, IRemoteComponentContext } from '@directum/sungero-remote-component-types';
import '../../../i18n';
import CallControlView from './call-control-view';
import { ICall } from './types';

interface IProps {
    initialContext: IRemoteComponentContext;
    api: IRemoteComponentCardApi;
}

const CallControl: React.FC<IProps> = ({ api }) => {
    // Получаем сущность из карточки веб клиента через метод getEntity.
    console.log("call-control");
    const [ entity ] = React.useState<ICall>(api.getEntity<ICall>());
    console.log(entity);
    if(entity.Status.Value == "Active")
        return <CallControlView entity={entity}/>
    else if(entity.Status.Value == "Close")
        return null;
};

export default CallControl;
