import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Шаблона кода для файла main.cpp.
 * Используется как константа для генерации базовой структуры C++ программы.
 */
const MAIN_CPP_TEMPLATE = `#include <iostream>

int main() {
    std::cout << "Hello, World from CMake!" << std::endl;
    return 0;
}
`;

/**
 * Точка входа в расширение. Вызывается при первой активации плагина.
 * 
 * @param context - Объект ExtensionContext, предоставляющий доступ к API жизненного цикла расширения,
 *                  подпискам (subscriptions) и путям к файлам расширения.
 */
export function activate(context: vscode.ExtensionContext) {
    
    // 1. Инициализация элемента панели состояния (Status Bar)
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(gear) C++ CMake Tools";
    statusBarItem.tooltip = "Нажмите, чтобы создать новый C++ проект";
    statusBarItem.command = 'extension.createCppCmakeProject';
    statusBarItem.show();
    
    // Добавляем в массив подписок для корректного освобождения ресурсов при деактивации
    context.subscriptions.push(statusBarItem);

    // 2. Регистрация основной команды плагина
    let disposable = vscode.commands.registerCommand('extension.createCppCmakeProject', async (uri?: vscode.Uri) => {
        
        // Шаг А: Запрос имени проекта с валидацией
        const projectName = await vscode.window.showInputBox({
            prompt: 'Введите имя нового C++ проекта',
            placeHolder: 'MyCppProject',
            validateInput: text => text.length === 0 ? 'Имя не может быть пустым' : null
        });

        // Прерывание выполнения, если пользователь отменил ввод (нажал Esc)
        if (!projectName) {
            return; 
        }

        // Шаг Б: Выбор стандарта C++ через интерактивное меню (Quick Pick)
        const cppStandard = await vscode.window.showQuickPick(
            ['C++11', 'C++14', 'C++17', 'C++20', 'C++23'],
            {
                placeHolder: 'Выберите стандарт C++ для проекта',
                canPickMany: false
            }
        );

        // Извлечение числового значения стандарта (например, "17" из "C++17")
        const selectedStandard = cppStandard ? cppStandard.replace('C++', '') : '17';

        // Шаг В: Определение базового пути для создания проекта
        let basePath: string;
        if (uri && uri.fsPath) {
            // Если команда вызвана через контекстное меню папки в проводнике
            basePath = uri.fsPath;
        } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            // Если в VS Code открыта рабочая область (workspace)
            basePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        } else {
            // Fallback: домашняя директория пользователя ОС
            basePath = os.homedir();
        }
            
        const projectPath = path.join(basePath, projectName);

        // Шаг Г: Создание директории проекта с обработкой ошибок
        try {
            if (fs.existsSync(projectPath)) {
                vscode.window.showErrorMessage(`❌ Папка "${projectName}" уже существует!`);
                return;
            }
            // recursive: true позволяет создавать вложенные папки, если их нет
            fs.mkdirSync(projectPath, { recursive: true });
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Ошибка создания папки: ${error}`);
            return;
        }

        // Шаг Д: Генерация и запись файлов проекта
        try {
            // Динамическая генерация CMakeLists.txt с подстановкой переменных через шаблонные строки JS
            const cmakeContent = `cmake_minimum_required(VERSION 3.10)
project(${projectName} VERSION 1.0)

set(CMAKE_CXX_STANDARD ${selectedStandard})
set(CMAKE_CXX_STANDARD_REQUIRED True)

add_executable(\${PROJECT_NAME} main.cpp)
`;
            
            fs.writeFileSync(path.join(projectPath, 'main.cpp'), MAIN_CPP_TEMPLATE);
            fs.writeFileSync(path.join(projectPath, 'CMakeLists.txt'), cmakeContent);
            
            vscode.window.showInformationMessage(`✅ Проект "${projectName}" успешно создан!`);
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Ошибка создания файлов: ${error}`);
            return;
        }

        // Шаг Е: Предложение открыть проект в новом окне
        const openFolder = await vscode.window.showInformationMessage(
            'Открыть созданный проект в новом окне VS Code?', 
            'Да', 'Нет'
        );
        
        if (openFolder === 'Да') {
            vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectPath));
        }

        // Шаг Ж: Автоматизация сборки через встроенный терминал
        const shouldBuild = await vscode.window.showInformationMessage(
            'Собрать проект (cmake + make) автоматически?',
            'Да', 'Нет'
        );

        if (shouldBuild === 'Да') {
            const terminal = vscode.window.createTerminal(`Build: ${projectName}`);
            terminal.show(); // Делаем терминал видимым
            
            // Последовательная отправка команд в терминал
            terminal.sendText(`cd "${projectPath}"`);
            terminal.sendText('mkdir -p build && cd build');
            terminal.sendText('cmake ..');
            terminal.sendText('make');
            
            vscode.window.showInformationMessage('🛠️ Команды сборки отправлены в терминал!');
        }
    });

    // Регистрация команды в массиве подписок для корректной очистки памяти
    context.subscriptions.push(disposable);
}

/**
 * Функция деактивации расширения.
 * Вызывается при отключении или удалении плагина.
 * VS Code автоматически вызывает метод .dispose() для всех объектов, 
 * добавленных в context.subscriptions.
 */
export function deactivate() {}