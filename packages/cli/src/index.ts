#!/usr/bin/env node

import { Command } from 'commander';
import { createTheme } from './commands/create-theme.js';
import { createPlugin } from './commands/create-plugin.js';
import { createWidget } from './commands/create-widget.js';

const program = new Command();

program
    .name('angple')
    .description('Angple CLI - 테마, 플러그인, 위젯 스캐폴딩 도구')
    .version('0.1.0');

const create = program
    .command('create')
    .description('새 테마, 플러그인, 위젯을 생성합니다');

create
    .command('theme <name>')
    .description('새 테마를 생성합니다')
    .option('-d, --description <desc>', '테마 설명')
    .option('-a, --author <author>', '작성자 이름')
    .option('--dir <dir>', '생성 경로 (기본: custom-themes/)')
    .action(createTheme);

create
    .command('plugin <name>')
    .description('새 플러그인을 생성합니다')
    .option('-d, --description <desc>', '플러그인 설명')
    .option('-a, --author <author>', '작성자 이름')
    .option('-t, --type <type>', '플러그인 타입 (board, editor, seo, ai, auth, media, social, analytics, custom)', 'custom')
    .option('--dir <dir>', '생성 경로 (기본: custom-plugins/)')
    .action(createPlugin);

create
    .command('widget <name>')
    .description('새 위젯을 생성합니다')
    .option('-d, --description <desc>', '위젯 설명')
    .option('-a, --author <author>', '작성자 이름')
    .option('-c, --category <category>', '위젯 카테고리 (content, sidebar, ad, social, utility)', 'sidebar')
    .option('-s, --slots <slots>', '위젯 슬롯 (쉼표로 구분)', 'sidebar')
    .option('--dir <dir>', '생성 경로 (기본: custom-widgets/)')
    .action(createWidget);

program.parse();
