// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

import React, {FC} from 'react';
import styled from 'styled-components';

const Icon = styled.svg`
    margin: 0 0 3.2rem 0;
    pointer-events: none;
`;

const NoContentPlaybookSvg = () => (
    <Icon
        width='142'
        height='88'
        viewBox='0 0 142 88'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
    >
        <path
            opacity='0.1'
            d='M141.5 56.518C141.508 61.2383 140.394 65.8702 138.281 69.9076C138.281 74.8453 136.291 79.3209 133.065 82.5827C132.257 83.398 131.387 84.1274 130.466 84.762C130.429 84.7891 130.391 84.8148 130.353 84.8405C130.284 84.8875 130.215 84.9346 130.145 84.9831L130.079 85.0273C127.025 86.9986 123.581 88.0225 120.084 87.9996H27.2666C26.5271 87.9996 25.7942 87.9654 25.0678 87.8969C22.4865 87.6617 19.95 86.982 17.5421 85.8802C17.0721 85.6653 16.6111 85.4343 16.1592 85.1871C15.9439 85.0701 15.7307 84.9498 15.5195 84.8262C15.3876 84.7492 15.2557 84.6693 15.1251 84.5895C13.6066 83.6635 12.1821 82.5446 10.8778 81.2535C6.68729 77.0845 4.08914 71.3253 4.08914 64.9643C1.7375 60.7739 0.490441 55.8822 0.500055 50.8857C0.500055 36.7459 10.2665 25.2831 22.3156 25.2831C22.6853 25.2831 23.0551 25.296 23.4249 25.3188C23.4779 25.3188 23.5296 25.3188 23.5826 25.3273C25.6138 21.321 28.329 17.6399 31.594 14.3994C40.5014 5.57093 53.5143 0 68.0099 0C80.1896 0 91.3229 3.92932 99.8507 10.4216C103.082 8.31045 106.73 7.20432 110.44 7.21112C122.487 7.21112 132.256 18.6739 132.256 32.8137C132.254 33.7084 132.213 34.6024 132.133 35.4922C135.037 37.8709 137.404 41.0229 139.034 44.6823C140.664 48.3416 141.51 52.401 141.5 56.518V56.518Z'
            fill='var(--button-bg)'
        />
        <path
            d='M118.238 17.5197V75.8245C118.238 76.1191 118.181 76.4109 118.068 76.6832C117.955 76.9555 117.789 77.2031 117.58 77.4116C117.37 77.6201 117.122 77.7855 116.848 77.8984C116.574 78.0113 116.281 78.0694 115.985 78.0694H26.0152C25.8048 78.0696 25.5955 78.0402 25.3935 77.9818C24.9224 77.8479 24.5081 77.5648 24.2136 77.1754C23.9192 76.786 23.7607 76.3116 23.7622 75.8245V49.8052C23.7622 49.6726 23.7622 49.5412 23.7622 49.4098V24.5952C23.8148 24.5952 23.8662 24.5952 23.9189 24.6025C25.9356 21.1846 26.7582 18.0441 30 15.2796H115.985C116.281 15.2796 116.574 15.3376 116.847 15.4501C117.12 15.5627 117.369 15.7277 117.578 15.9357C117.787 16.1437 117.953 16.3907 118.066 16.6625C118.179 16.9342 118.238 17.2255 118.238 17.5197Z'
            fill='var(--center-channel-bg)'
        />
        <path
            opacity='0.7'
            d='M32.8181 32.3142H112.608'
            stroke='#3D3C40'
            strokeOpacity='0.16'
            strokeWidth='0.5'
            strokeMiterlimit='10'
            strokeLinecap='round'
        />
        <path
            opacity='0.7'
            d='M32.8181 46.9762H112.608'
            stroke='#3D3C40'
            strokeOpacity='0.16'
            strokeWidth='0.5'
            strokeMiterlimit='10'
            strokeLinecap='round'
        />
        <path
            opacity='0.7'
            d='M32.8181 61.6382H112.608'
            stroke='#3D3C40'
            strokeOpacity='0.16'
            strokeWidth='0.5'
            strokeMiterlimit='10'
            strokeLinecap='round'
        />
        <path
            d='M78.6511 22.8515H66.1845C64.9693 22.8515 63.9841 23.831 63.9841 25.0392C63.9841 26.2475 64.9693 27.2269 66.1845 27.2269H78.6511C79.8663 27.2269 80.8514 26.2475 80.8514 25.0392C80.8514 23.831 79.8663 22.8515 78.6511 22.8515Z'
            fill='var(--center-channel-text)'
        />
        <path
            opacity='0.1'
            d='M78.2863 23.5839H66.5479C65.7388 23.5839 65.083 24.2357 65.083 25.0397C65.083 25.8438 65.7388 26.4956 66.5479 26.4956H78.2863C79.0953 26.4956 79.7512 25.8438 79.7512 25.0397C79.7512 24.2357 79.0953 23.5839 78.2863 23.5839Z'
            fill='var(--center-channel-text)'
        />
        <path
            d='M78.0808 23.7434H75.391C74.6712 23.7434 74.0876 24.3236 74.0876 25.0393V25.0405C74.0876 25.7562 74.6712 26.3363 75.391 26.3363H78.0808C78.8006 26.3363 79.3841 25.7562 79.3841 25.0405V25.0393C79.3841 24.3236 78.8006 23.7434 78.0808 23.7434Z'
            fill='var(--button-bg)'
        />
        <path
            d='M76.6954 25.8496C77.1455 25.8496 77.5105 25.4868 77.5105 25.0392C77.5105 24.5917 77.1455 24.2289 76.6954 24.2289C76.2453 24.2289 75.8804 24.5917 75.8804 25.0392C75.8804 25.4868 76.2453 25.8496 76.6954 25.8496Z'
            fill='var(--center-channel-bg)'
        />
        <path
            d='M78.6511 51.6948H66.1845C64.9693 51.6948 63.9841 52.6742 63.9841 53.8825C63.9841 55.0907 64.9693 56.0702 66.1845 56.0702H78.6511C79.8663 56.0702 80.8514 55.0907 80.8514 53.8825C80.8514 52.6742 79.8663 51.6948 78.6511 51.6948Z'
            fill='var(--center-channel-text)'
        />
        <path
            opacity='0.1'
            d='M78.2863 52.4272H66.5479C65.7388 52.4272 65.083 53.0791 65.083 53.8831C65.083 54.6871 65.7388 55.3389 66.5479 55.3389H78.2863C79.0953 55.3389 79.7512 54.6871 79.7512 53.8831C79.7512 53.0791 79.0953 52.4272 78.2863 52.4272Z'
            fill='var(--center-channel-text)'
        />
        <path
            d='M78.0808 52.5867H75.391C74.6712 52.5867 74.0876 53.1669 74.0876 53.8825V53.8838C74.0876 54.5994 74.6712 55.1796 75.391 55.1796H78.0808C78.8006 55.1796 79.3841 54.5994 79.3841 53.8838V53.8825C79.3841 53.1669 78.8006 52.5867 78.0808 52.5867Z'
            fill='var(--button-bg)'
        />
        <path
            d='M76.6954 54.6929C77.1455 54.6929 77.5105 54.3301 77.5105 53.8825C77.5105 53.435 77.1455 53.0721 76.6954 53.0721C76.2453 53.0721 75.8804 53.435 75.8804 53.8825C75.8804 54.3301 76.2453 54.6929 76.6954 54.6929Z'
            fill='var(--center-channel-bg)'
        />
        <path
            d='M78.6511 66.1171H66.1845C64.9693 66.1171 63.9841 67.0966 63.9841 68.3049C63.9841 69.5131 64.9693 70.4926 66.1845 70.4926H78.6511C79.8663 70.4926 80.8514 69.5131 80.8514 68.3049C80.8514 67.0966 79.8663 66.1171 78.6511 66.1171Z'
            fill='var(--center-channel-text)'
        />
        <path
            opacity='0.1'
            d='M78.2863 66.8484H66.5479C65.7388 66.8484 65.083 67.5002 65.083 68.3042C65.083 69.1083 65.7388 69.7601 66.5479 69.7601H78.2863C79.0953 69.7601 79.7512 69.1083 79.7512 68.3042C79.7512 67.5002 79.0953 66.8484 78.2863 66.8484Z'
            fill='var(--center-channel-text)'
        />
        <path
            d='M78.0808 67.0078H75.391C74.6712 67.0078 74.0876 67.588 74.0876 68.3036V68.3048C74.0876 69.0205 74.6712 69.6007 75.391 69.6007H78.0808C78.8006 69.6007 79.3841 69.0205 79.3841 68.3048V68.3036C79.3841 67.588 78.8006 67.0078 78.0808 67.0078Z'
            fill='var(--button-bg)'
        />
        <path
            d='M76.6954 69.1152C77.1455 69.1152 77.5105 68.7524 77.5105 68.3049C77.5105 67.8573 77.1455 67.4945 76.6954 67.4945C76.2453 67.4945 75.8804 67.8573 75.8804 68.3049C75.8804 68.7524 76.2453 69.1152 76.6954 69.1152Z'
            fill='var(--center-channel-bg)'
        />
        <path
            d='M78.6511 37.2738H66.1845C64.9693 37.2738 63.9841 38.2533 63.9841 39.4616C63.9841 40.6698 64.9693 41.6493 66.1845 41.6493H78.6511C79.8663 41.6493 80.8514 40.6698 80.8514 39.4616C80.8514 38.2533 79.8663 37.2738 78.6511 37.2738Z'
            fill='var(--center-channel-text)'
        />
        <path
            opacity='0.1'
            d='M78.2863 38.005H66.5479C65.7388 38.005 65.083 38.6568 65.083 39.4609C65.083 40.2649 65.7388 40.9167 66.5479 40.9167H78.2863C79.0953 40.9167 79.7512 40.2649 79.7512 39.4609C79.7512 38.6568 79.0953 38.005 78.2863 38.005Z'
            fill='var(--center-channel-text)'
        />
        <path
            d='M66.7534 40.7585H69.4433C70.1631 40.7585 70.7466 40.1783 70.7466 39.4627V39.4615C70.7466 38.7458 70.1631 38.1656 69.4433 38.1656H66.7534C66.0336 38.1656 65.4501 38.7458 65.4501 39.4615V39.4627C65.4501 40.1783 66.0336 40.7585 66.7534 40.7585Z'
            fill='var(--button-bg)'
        />
        <path
            d='M68.1388 40.2719C68.5889 40.2719 68.9538 39.9091 68.9538 39.4615C68.9538 39.014 68.5889 38.6512 68.1388 38.6512C67.6886 38.6512 67.3237 39.014 67.3237 39.4615C67.3237 39.9091 67.6886 40.2719 68.1388 40.2719Z'
            fill='var(--center-channel-bg)'
        />
        <path
            d='M45.5 25.0009C45.5002 25.6934 45.3206 26.374 44.9788 26.9762C44.6371 27.5785 44.1448 28.0817 43.5502 28.4366L43.4957 28.4689L43.3928 28.526L43.2949 28.577L43.2796 28.5847C43.2387 28.6051 43.197 28.6247 43.1545 28.6434C43.0189 28.7052 42.88 28.7592 42.7383 28.8051C42.6455 28.8349 42.5519 28.8621 42.4574 28.8851C42.2636 28.9325 42.0664 28.9652 41.8677 28.983C41.7468 28.994 41.6251 29 41.5017 29C41.3547 28.9998 41.2078 28.9919 41.0617 28.9762H41.0362C40.986 28.9711 40.9357 28.9643 40.8855 28.9566C40.7259 28.9315 40.5679 28.8972 40.4123 28.8536L40.3349 28.8306L40.2668 28.8094L40.2447 28.8017C40.1057 28.756 39.9693 28.7026 39.8362 28.6417V28.6417C39.6075 28.5373 39.3894 28.4111 39.1851 28.2647L39.1749 28.2579L39.1681 28.2528L39.0949 28.1992L39.0396 28.1566C38.9315 28.0724 38.828 27.9824 38.7298 27.8868C38.6379 27.7983 38.5505 27.7056 38.4677 27.6085C38.0469 27.1195 37.7507 26.5359 37.6043 25.9075C37.4579 25.2792 37.4657 24.6248 37.627 24.0001C37.7882 23.3754 38.0982 22.799 38.5305 22.3201C38.9627 21.8411 39.5044 21.4738 40.1093 21.2495C40.7142 21.0252 41.3644 20.9506 42.0044 21.0319C42.6444 21.1133 43.2553 21.3482 43.7848 21.7168C44.3144 22.0853 44.7469 22.5764 45.0456 23.1483C45.3443 23.7201 45.5002 24.3558 45.5 25.0009V25.0009Z'
            fill='var(--button-bg)'
        />
        <path
            d='M45.5 40.0009C45.5002 40.6934 45.3206 41.374 44.9788 41.9763C44.6371 42.5785 44.1448 43.0817 43.5502 43.4366L43.4957 43.469L43.3928 43.526L43.2949 43.577L43.2796 43.5847C43.2387 43.6051 43.197 43.6247 43.1545 43.6434C43.0189 43.7052 42.88 43.7592 42.7383 43.8051C42.6455 43.8349 42.5519 43.8621 42.4574 43.8851C42.2636 43.9325 42.0664 43.9652 41.8677 43.983C41.7468 43.9941 41.6251 44 41.5017 44C41.3547 43.9998 41.2078 43.9919 41.0617 43.9762H41.0362C40.986 43.9711 40.9357 43.9643 40.8855 43.9566C40.7259 43.9315 40.5679 43.8972 40.4123 43.8536L40.3349 43.8306L40.2668 43.8094L40.2447 43.8017C40.1057 43.756 39.9693 43.7026 39.8362 43.6417V43.6417C39.6075 43.5374 39.3894 43.4111 39.1851 43.2647L39.1749 43.2579L39.1681 43.2528L39.0949 43.1992L39.0396 43.1566C38.9315 43.0724 38.828 42.9824 38.7298 42.8868C38.6379 42.7983 38.5505 42.7056 38.4677 42.6085C38.0469 42.1195 37.7507 41.5359 37.6043 40.9075C37.4579 40.2792 37.4657 39.6248 37.627 39.0001C37.7882 38.3754 38.0982 37.799 38.5305 37.3201C38.9627 36.8411 39.5044 36.4738 40.1093 36.2495C40.7142 36.0252 41.3644 35.9506 42.0044 36.0319C42.6444 36.1133 43.2553 36.3482 43.7848 36.7168C44.3144 37.0853 44.7469 37.5764 45.0456 38.1483C45.3443 38.7201 45.5002 39.3558 45.5 40.0009V40.0009Z'
            fill='var(--button-bg)'
        />
        <path
            d='M45.5 54.0009C45.5002 54.6934 45.3206 55.374 44.9788 55.9763C44.6371 56.5785 44.1448 57.0817 43.5502 57.4366L43.4957 57.469L43.3928 57.526L43.2949 57.577L43.2796 57.5847C43.2387 57.6051 43.197 57.6247 43.1545 57.6434C43.0189 57.7052 42.88 57.7592 42.7383 57.8051C42.6455 57.8349 42.5519 57.8621 42.4574 57.8851C42.2636 57.9325 42.0664 57.9652 41.8677 57.983C41.7468 57.9941 41.6251 58 41.5017 58C41.3547 57.9998 41.2078 57.9919 41.0617 57.9762H41.0362C40.986 57.9711 40.9357 57.9643 40.8855 57.9566C40.7259 57.9315 40.5679 57.8972 40.4123 57.8536L40.3349 57.8306L40.2668 57.8094L40.2447 57.8017C40.1057 57.756 39.9693 57.7026 39.8362 57.6417V57.6417C39.6075 57.5374 39.3894 57.4111 39.1851 57.2647L39.1749 57.2579L39.1681 57.2528L39.0949 57.1992L39.0396 57.1566C38.9315 57.0724 38.828 56.9824 38.7298 56.8868C38.6379 56.7983 38.5505 56.7056 38.4677 56.6085C38.0469 56.1195 37.7507 55.5359 37.6043 54.9075C37.4579 54.2792 37.4657 53.6248 37.627 53.0001C37.7882 52.3754 38.0982 51.799 38.5305 51.3201C38.9627 50.8411 39.5044 50.4738 40.1093 50.2495C40.7142 50.0252 41.3644 49.9506 42.0044 50.0319C42.6444 50.1133 43.2553 50.3482 43.7848 50.7168C44.3144 51.0853 44.7469 51.5764 45.0456 52.1483C45.3443 52.7201 45.5002 53.3558 45.5 54.0009V54.0009Z'
            fill='var(--button-bg)'
        />
        <path
            d='M45.5 69.0009C45.5002 69.6934 45.3206 70.374 44.9788 70.9762C44.6371 71.5785 44.1448 72.0817 43.5502 72.4366L43.4957 72.4689L43.3928 72.526L43.2949 72.577L43.2796 72.5847C43.2387 72.6051 43.197 72.6247 43.1545 72.6434C43.0189 72.7052 42.88 72.7592 42.7383 72.8051C42.6455 72.8349 42.5519 72.8621 42.4574 72.8851C42.2636 72.9325 42.0664 72.9652 41.8677 72.983C41.7468 72.994 41.6251 73 41.5017 73C41.3547 72.9998 41.2078 72.9919 41.0617 72.9762H41.0362C40.986 72.9711 40.9357 72.9643 40.8855 72.9566C40.7259 72.9315 40.5679 72.8972 40.4123 72.8536L40.3349 72.8306L40.2668 72.8094L40.2447 72.8017C40.1057 72.756 39.9693 72.7026 39.8362 72.6417V72.6417C39.6075 72.5373 39.3894 72.4111 39.1851 72.2647L39.1749 72.2579L39.1681 72.2528L39.0949 72.1992L39.0396 72.1566C38.9315 72.0724 38.828 71.9824 38.7298 71.8868C38.6379 71.7983 38.5505 71.7056 38.4677 71.6085C38.0469 71.1195 37.7507 70.5359 37.6043 69.9075C37.4579 69.2792 37.4657 68.6248 37.627 68.0001C37.7882 67.3754 38.0982 66.799 38.5305 66.3201C38.9627 65.8411 39.5044 65.4738 40.1093 65.2495C40.7142 65.0252 41.3644 64.9506 42.0044 65.0319C42.6444 65.1133 43.2553 65.3482 43.7848 65.7168C44.3144 66.0853 44.7469 66.5764 45.0456 67.1483C45.3443 67.7201 45.5002 68.3558 45.5 69.0009V69.0009Z'
            fill='var(--button-bg)'
        />
        <g opacity='0.3'>
            <path
                opacity='0.3'
                d='M43.2559 59.3558L43.2602 59.3543L43.2559 59.3558Z'
                fill='var(--button-bg)'
            />
            <path
                opacity='0.3'
                d='M38.7425 59.1645L38.7205 59.1548C38.7272 59.1591 38.7347 59.1624 38.7425 59.1645Z'
                fill='var(--button-bg)'
            />
        </g>
        <path
            d='M106.109 23.2981L105.619 22.8114C105.595 22.7872 105.567 22.7681 105.535 22.755C105.504 22.7419 105.47 22.7352 105.436 22.7352C105.402 22.7352 105.368 22.7419 105.336 22.755C105.305 22.7681 105.276 22.7872 105.252 22.8114L102.21 25.8119L100.922 24.5221C100.899 24.4977 100.87 24.4783 100.839 24.465C100.807 24.4518 100.773 24.4449 100.739 24.4449C100.705 24.4449 100.671 24.4518 100.639 24.465C100.608 24.4783 100.579 24.4977 100.555 24.5221L100.066 25.0088C100.042 25.0328 100.023 25.0613 100.01 25.0926C99.9965 25.1239 99.9897 25.1575 99.9897 25.1914C99.9897 25.2253 99.9965 25.2588 100.01 25.2902C100.023 25.3215 100.042 25.3499 100.066 25.3739L102.024 27.3316C102.048 27.3556 102.077 27.3747 102.108 27.3876C102.14 27.4006 102.173 27.4073 102.207 27.4073C102.242 27.4073 102.275 27.4006 102.307 27.3876C102.338 27.3747 102.367 27.3556 102.391 27.3316L106.104 23.668C106.129 23.6444 106.15 23.6159 106.164 23.5843C106.178 23.5527 106.185 23.5186 106.186 23.4841C106.186 23.4495 106.179 23.4153 106.166 23.3833C106.153 23.3513 106.134 23.3224 106.109 23.2981V23.2981Z'
            fill='var(--online-indicator)'
        />
        <path
            d='M106.109 37.5512L105.619 37.0645C105.595 37.0404 105.567 37.0212 105.535 37.0081C105.504 36.9951 105.47 36.9883 105.436 36.9883C105.402 36.9883 105.368 36.9951 105.336 37.0081C105.305 37.0212 105.276 37.0404 105.252 37.0645L102.216 40.0699L100.929 38.7802C100.905 38.7557 100.876 38.7363 100.845 38.723C100.813 38.7098 100.779 38.7029 100.745 38.7029C100.711 38.7029 100.677 38.7098 100.645 38.723C100.614 38.7363 100.585 38.7557 100.561 38.7802L100.072 39.2669C100.048 39.2908 100.029 39.3193 100.016 39.3506C100.003 39.3819 99.9958 39.4155 99.9958 39.4494C99.9958 39.4833 100.003 39.5168 100.016 39.5482C100.029 39.5795 100.048 39.6079 100.072 39.6319L102.03 41.5897C102.054 41.6136 102.083 41.6327 102.114 41.6457C102.146 41.6586 102.179 41.6653 102.214 41.6653C102.248 41.6653 102.281 41.6586 102.313 41.6457C102.344 41.6327 102.373 41.6136 102.397 41.5897L106.106 37.9162C106.131 37.8925 106.15 37.8642 106.164 37.833C106.177 37.8018 106.184 37.7682 106.184 37.7342C106.184 37.7003 106.178 37.6666 106.165 37.6352C106.152 37.6038 106.133 37.5753 106.109 37.5512Z'
            fill='var(--online-indicator)'
        />
        <path
            d='M106.109 66.3154L105.619 65.8287C105.595 65.8047 105.567 65.7857 105.535 65.7727C105.504 65.7597 105.47 65.7531 105.436 65.7531C105.402 65.7531 105.368 65.7597 105.336 65.7727C105.305 65.7857 105.276 65.8047 105.252 65.8287L102.21 68.8292L100.923 67.5395C100.899 67.5154 100.87 67.4962 100.838 67.4831C100.807 67.47 100.773 67.4633 100.739 67.4633C100.705 67.4633 100.671 67.47 100.639 67.4831C100.608 67.4962 100.579 67.5154 100.555 67.5395L100.066 68.0262C100.042 68.0501 100.022 68.0785 100.009 68.1098C99.996 68.1411 99.9893 68.1748 99.9893 68.2087C99.9893 68.2426 99.996 68.2763 100.009 68.3076C100.022 68.3389 100.042 68.3673 100.066 68.3912L102.024 70.349C102.073 70.3971 102.139 70.4241 102.207 70.4241C102.276 70.4241 102.342 70.3971 102.391 70.349L106.104 66.6841C106.129 66.6607 106.15 66.6323 106.164 66.6008C106.178 66.5693 106.186 66.5353 106.186 66.5008C106.186 66.4663 106.18 66.4321 106.167 66.4002C106.153 66.3684 106.134 66.3395 106.109 66.3154V66.3154Z'
            fill='var(--online-indicator)'
        />
    </Icon>
);

export default NoContentPlaybookSvg;
