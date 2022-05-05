import * as vscode from 'vscode'
import { getExtensionSetting, getExtensionSettingId, registerExtensionCommand } from 'vscode-framework'

export const activate = () => {
    const activateIfEnabled = () => {
        const openType = getExtensionSetting('openType')
        if (openType === 'disabled') return
        let currentOpenEditor: vscode.TextEditor | undefined
        let changeTextDocumentDisposable: vscode.Disposable | undefined
        let scrollDocumenttDisposable: vscode.Disposable | undefined
        let scrollDocument = true
        const updateScrollLockStatus = () => {
            void vscode.commands.executeCommand('setContext', 'typescript-service-logger.scrollLockEnabled', scrollDocument)
        }

        registerExtensionCommand('toggleScrollLock', () => {
            scrollDocument = !scrollDocument
            updateScrollLockStatus()
        })
        registerExtensionCommand('disableScrollLock', () => {
            scrollDocument = false
            updateScrollLockStatus()
        })
        registerExtensionCommand('enableScrollLock', () => {
            scrollDocument = true
            updateScrollLockStatus()
        })
        updateScrollLockStatus()
        const detectVisibleEditor = () => {
            const isTsOutputOpened = vscode.window.visibleTextEditors.some(
                ({ document }) => document.uri.scheme === 'output' && document.uri.path === 'extension-output-vscode.typescript-language-features-#1',
            )
            console.log(
                'opened outputs',
                vscode.window.visibleTextEditors.filter(({ document }) => document.uri.scheme === 'output').map(item => item.document.uri.path),
            )
            if (isTsOutputOpened)
                changeTextDocumentDisposable = vscode.workspace.onDidChangeTextDocument(async ({ document, contentChanges }) => {
                    if (document.uri.scheme === 'output' && document.uri.path === 'extension-output-vscode.typescript-language-features-#1') {
                        const allChanges = contentChanges.map(({ text }) => text).join('\n')
                        console.log('analyzing', allChanges)
                        const logFile = new RegExp(` <${openType}> Log file: (.+)(\\r?)\\n`).exec(allChanges)?.[1]
                        if (!logFile) {
                            console.log('No log file!')
                            return
                        }

                        /* if (currentOpenEditor)  */ await vscode.commands.executeCommand('workbench.action.closeEditorsInOtherGroups')
                        scrollDocumenttDisposable?.dispose()

                        currentOpenEditor = await vscode.window.showTextDocument(vscode.Uri.file(logFile), {
                            preserveFocus: true,
                            preview: true,
                            viewColumn: vscode.ViewColumn.Beside,
                        })
                        scrollDocumenttDisposable = vscode.Disposable.from(
                            vscode.workspace.onDidChangeTextDocument(({ document }) => {
                                if (document.uri !== currentOpenEditor!.document.uri || !scrollDocument) return
                                const pos = new vscode.Position(currentOpenEditor!.document.lineCount, 0)
                                currentOpenEditor!.revealRange(new vscode.Range(pos, pos.translate(0, 1)))
                            }),
                            vscode.window.onDidChangeActiveTextEditor(editor => {
                                if (!editor || editor.viewColumn === undefined) return
                                void vscode.commands.executeCommand(
                                    'setContext',
                                    `typescript-service-logger.showScrollButton`,
                                    editor.document.uri === currentOpenEditor!.document.uri,
                                )
                            }),
                        )
                        // await new Promise(resolve => {
                        //     setTimeout(resolve, 500)
                        // })
                    }
                })
            else changeTextDocumentDisposable?.dispose()
        }

        vscode.window.onDidChangeVisibleTextEditors(detectVisibleEditor)
        detectVisibleEditor()
    }

    activateIfEnabled()
    vscode.workspace.onDidChangeConfiguration(({ affectsConfiguration }) => {
        if (affectsConfiguration(getExtensionSettingId('openType'))) activateIfEnabled()
    })
}
