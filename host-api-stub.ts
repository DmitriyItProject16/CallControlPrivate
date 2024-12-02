import { IEntity, IRemoteComponentCardApi } from '@directum/sungero-remote-component-types';

/** Заглушка API для отладки в режиме standalone. */
class HostStubApi implements IRemoteComponentCardApi {
  public executeAction(actionName: string): Promise<void> {
    console.log(`Action ${actionName} executed.`)
    return Promise.resolve();
  }

  public canExecuteAction(actionName: string): boolean {
    return true;
  }

  public getEntity<T extends IEntity>(): T {
    return {
      Id: 1, 
      Status: { Value: 'Active', DisplayValue: 'Действующая' },
      IP: '',
      Port: '', 
      Login: '', 
      Password:'',
      NameToCall: 'Иванов Иван Иванович', 
      NumberPhone: "8**********",
      StartTime: null,
      PathToRingtones: ""
    } as unknown as T;
  }

  public onControlUpdate?: (() => void);
}
  
const api: IRemoteComponentCardApi = new HostStubApi();
export default api;
  