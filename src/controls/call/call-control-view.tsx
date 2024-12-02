import React, { useEffect, useState} from 'react';
import JsSIP from 'jssip';
import { ICall } from './types';
import { useGlobalAudioPlayer } from "react-use-audio-player"
//import './call-view.css';
//import './content/appStyles_4.9.0.0089_6dc759f0.css'; //TODO: перед сборкой в релиз закомментить, стили будут автоматом подтягиваться из RX
import moment from 'moment';//HACK: библиотека для сохранения даты в нужном формате
import { IEnumPropertyValue} from '@directum/sungero-remote-component-types';
interface IProps {
    entity: ICall;
}

//TODO: Нужно еще будет перелопачивать механизм
const CallControlView: React.FunctionComponent<IProps> = ({entity}) => {
    console.log(entity.Port, ', ', entity.IP
        , ', ', entity.Login, ', ', entity.Password
        , ', ', entity.NumberPhone, ', ', entity.NameToCall, ', ', entity.StartTime);
    const { load, stop } = useGlobalAudioPlayer();
    const [ua, setUa] = useState<JsSIP.UA | null>(null);
    const [isRegistered, setIsRegistered] = useState(false);
    const [currentCall, setCurrentCall] = useState<JsSIP.WeightedSocket | null>(null);
    var pathSound = entity.PathToRingtones;//TODO: пока закинул аудио сюда
    var peerconnection: any; //Необходимо сразу присваивать значение
    var localClonedStream: any;
    var startTime: string;
    var maxAttempts = 3;
    var currentAttempt = 0;
    useEffect(() => {
        // Устанавливаем параметры отладки
        window.localStorage.setItem('debug', '* -engine* -socket* *ERROR* *WARN*');
        if(currentAttempt < maxAttempts)
        {
            console.log("useEffect: " + currentAttempt + ' ' + maxAttempts)
            connectToServer();
        }
    }, [currentAttempt, maxAttempts]);
    
    const connectToServer = () => {
        try
        {
            localStorage.setItem('login', entity.Login);
            localStorage.setItem('pwd', entity.Password);

            const socket = new JsSIP.WebSocketInterface(`wss://${entity.IP}:${entity.Port}/ws`);
            
            const configuration = {
                uri: `sip:${entity.Login}@${entity.IP}`,
                password: entity.Password,
                display_name: entity.Login,
                sockets: [socket],
                register: true
            };

            const userAgent = new JsSIP.UA(configuration);
            setUa(userAgent);
            
            userAgent.on('registered', () => {
                console.log("UA registered");
                setIsRegistered(true);
            });

            userAgent.on('unregistered', () => {
                console.log("UA unregistered");
                setIsRegistered(false);
                setCurrentCall(null);
            });

            userAgent.on('registrationFailed', (data) => {
                console.error("UA registrationFailed", data.cause);
            });

            userAgent.on('disconnected', function(error) {
                console.error('disconnected: ' + currentAttempt);
                if (currentAttempt < maxAttempts) {
                    currentAttempt++;
                    setTimeout(connectToServer, 1000); // Повторяем попытку через 1 секунду
                } else {
                    console.error(`Failed to connect after ${maxAttempts} attempts.`);
                    userAgent?.stop();//TODO: нужно подумать как отправлять в RX Error. Хотелось чтобы пользователь видел ошибку.
                    setUa(null);
                }
            });

            // Обработчик успешного подключения
            userAgent.on('connected', function() {
                console.log('Connected to the server!');
            });
            userAgent.start();
        }
        catch(error)
        {
            console.error('Error connecting to the server:', error);
        }
    };
    
    const call = () => {
        if (ua && currentCall === null) {
            const session = ua.call(`sip:${entity.NumberPhone}@${entity.IP}`, {
                pcConfig: {
                    //TODO: не нашелhackStripTcp: true,
                    rtcpMuxPolicy: 'require',
                    iceServers: [],
                },
                mediaConstraints: {
                    audio: true,
                    video: false
                },
                rtcOfferConstraints: {
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: false
                }});

            setCurrentCall(session);
            
            //Соединение прошло успешно
            session.on('connecting', async () => {
                console.log("UA session connecting");
                load(`${pathSound}/ringback.ogg`, {
                    autoplay: true,
                    html5: true,
                    loop: true
                });
                //TODO: реализовать нормальную логику со стримом и выбором микрофона. 
                
                const microphones = await getAvailableMicrophones();
                
                // Изначально используем первый доступный микрофон
                let microphoneDeviceId = microphones[0].deviceId;
                await displayMicrophones();
                // Тут мы подключаемся к микрофону и цепляем к нему поток, который пойдёт в астер
                peerconnection = session.connection;
                await updateMicrophone(microphoneDeviceId);
                let senders = peerconnection.getSenders();
                // Получаем локальные потоки
                let localStreams = senders.map((s: JsSIP.WeightedSocket.Sender) => (s.track as any).stream).filter(Boolean);
                
                if (localStreams.length > 0) {
                    localClonedStream = localStreams[0].clone();

                    console.log('UA set local stream');

                    let localAudioControl = document.getElementById("localAudio") as HTMLAudioElement | null;
                    if (localAudioControl) {
                        localAudioControl.srcObject = localClonedStream;
                    }
                }

                peerconnection.addEventListener('addstream', (event: Event) => {
                    console.log("UA session addstream");
        
                    let remoteAudioControl = document.getElementById("remoteAudio") as HTMLAudioElement | null;
                    if (remoteAudioControl)
                        remoteAudioControl.srcObject = (event as any).stream;
                });
            });
            
            // В процессе дозвона
            session.on('progress', () => {
                console.log("UA session progress");
                load(`${pathSound}/ringback.ogg`, {
                    autoplay: true,
                    html5: true,
                    loop: false
                });
            });

            session.on('ended', () => {
                console.log("Call ended");
                setCurrentCall(null);
                load(`${pathSound}/rejected.mp3`, {
                    autoplay: true,
                    html5: true,
                    loop: false
                });
                console.log("localClonedStream: "+ localClonedStream);
                JsSIP.Utils.closeMediaStream(localClonedStream);
                //TODO: использовать функцию hangUp
                hangUp();
            });

            session.on('failed', (data) => {
                console.log("Call failed", data.cause);
                setCurrentCall(null);
            });

            // Звонок принят, моно начинать говорить
            session.on('accepted', () => {
                console.log("UA session accepted");
                load(`${pathSound}/answered.mp3`, {
                    autoplay: true,
                    html5: true,
                    loop: false
                });
                //startTime = session.start_time.toLocaleString('yyyyMMDD-HHmm');
                startTime = moment(session.start_time).format('yyyyMMDD-HHmm');//TODO+ колсек
                entity.changeProperty("StartTime", startTime);
            });
        }
        else
            console.error("UA is null");
    };

    const hangUp = () => {
        console.log("hungUp");
        //TODO: проанализировать - все ли инстансы закрываются.
        if (currentCall) {
            currentCall.terminate();
            setCurrentCall(null);
            JsSIP.Utils.closeMediaStream(localClonedStream);
            stop();
        }
        ua?.stop();
        //TODO: походу из-за изменения свойств начинается немыслимое в консоле логи дублируются.
        /*TODO - не работает код ниже, т.к. startTime - underfined
        console.log("hungUp " + startTime);
        if(startTime)
            entity.changeProperty("StartTime", startTime);*/
        // TODO: как менять статус?
        const statusClosed: IEnumPropertyValue = { Value: 'Closed', DisplayValue: 'Закрытая' };
        entity.changeProperty("Status", statusClosed)
            .finally(()=> window.history.back()).catch(()=> "Не удалось изменить статус звонка.");
    };
    
    
    const displayMicrophones = async () => {
        console.log("displayMicrophones");
        const microphones = await getAvailableMicrophones();
        
        const select = document.getElementById('microphoneSelect');
    
        if (select) {
            microphones.forEach(microphone => {
                const option = document.createElement('option');
                option.value = microphone.deviceId;
                option.textContent = microphone.label || `Микрофон ${microphones.indexOf(microphone) + 1}`;
                select.appendChild(option);
            });
    
            select.addEventListener('change', async (event) => {
                const selectedDeviceId = (event.target as HTMLSelectElement).value;
                await updateMicrophone(selectedDeviceId);
            });
        } else {
            console.warn('Элемент с id "microphoneSelect" не найден.');
        }
    }
    
    const getAvailableMicrophones = async () => {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter(device => device.kind === 'audioinput');
    }
    
    const updateMicrophone = async (deviceId: any) =>  {
        try {
            const constraints = {
                audio: { deviceId: { exact: deviceId } }
            };
            
            if(peerconnection)
            {
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
    
                // Находим текущий аудиосендер
                //let peerconnection = currentCall.connection;
                let senders = peerconnection.getSenders();
                let sender = senders.find((s: JsSIP.WeightedSocket.Sender) => s.track.kind === 'audio');
        
                if (sender) {
                    // Замещаем текущий аудиотрек на новый
                    sender.replaceTrack(stream.getAudioTracks()[0]);
                    console.log('Микрофон успешно обновлен');
                } else {
                    console.warn('Аудио-сендер не найден');
                }
            }
        } catch (error) {
            console.error('Не удалось обновить микрофон:', error);
        }
    }
    
    return (
        <div className="container">
            {isRegistered && (
                <div className="ribbon" id="callPanel">
                    <div className="ribbon__main-buttons" style={{ maxWidth: '626px' }}>
                        <span className="ribbon-item ribbon__button-container">
                            <div tabIndex={-1} className="button button_flat ribbon-item ribbon__button">
                                <div id="callNumberButton" className="button__content button__content_has-text button__content_has-icon ribbon-item__content" onClick={call}>
                                    <span className="button__text ribbon-item__text">Аудиозвонок</span>
                                </div>
                            </div>
                        </span>
                        <span className="ribbon-item ribbon__button-container">
                            <div tabIndex={-1} className="button button_flat ribbon-item ribbon__button">
                                <div id="hangUpButton" className="button__content button__content_has-text button__content_has-icon ribbon-item__content" onClick={hangUp}>
                                    <span className="button__text ribbon-item__text">Завершить звонок</span>
                                </div>
                            </div>
                        </span>
                    </div>
                    <select id="microphoneSelect" className="form-select"></select>
                </div>
            )}

            <audio id="localAudio" autoPlay muted></audio>
            <audio id="remoteAudio" autoPlay></audio>
            
        </div>
    );
};

/*TODO: хочется чтобы микро отображались также как и другие комбобоксы системы, на подумать
<span tabIndex={-1} className="ribbon-item ribbon__button-container">
                            <div className='button button_flat popup-button__button ribbon-item ribbon__button'>
                                <div className="button button_flat popup-button__button ribbon-item ribbon__button tether-element-attached-top tether-element-attached-right tether-target-attached-bottom tether-target-attached-right tether-target-enabled">
                                    <img className="button__expander-icon popup-button__button-expander" src={"images/arrow_tree_4.9.0.0089.svg"}/>
                                    <span className='button__text popup-button__button-text ribbon-item__text'>Микрофон</span>
                                    <img className="button__expander-icon popup-button__button-expander" src={"images/arrow_tree_4.9.0.0089.svg"}/>
                                </div>
                            </div>
                        </span>
*/

export default CallControlView;