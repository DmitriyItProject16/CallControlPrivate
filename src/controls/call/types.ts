import { IEntity, IEnumPropertyValue} from '@directum/sungero-remote-component-types';

export interface ICall extends IEntity {
    Id: number;
    Status: IEnumPropertyValue;
    IP: string;
    Port: string;
    Login: string;
    Password: string;
    NameToCall: string;
    NumberPhone: string;
    StartTime: string;//Date | null;
    PathToRingtones: string;
}
