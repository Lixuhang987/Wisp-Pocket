import SwiftUI

struct MCPSettingsView: View {
    private enum TransportOption: String, CaseIterable, Identifiable {
        case stdio
        case streamableHTTP = "streamableHttp"

        var id: String { rawValue }
        var title: String {
            switch self {
            case .stdio: return "stdio"
            case .streamableHTTP: return "HTTP"
            }
        }
    }

    @Bindable var viewModel: MCPSettingsViewModel
    @Environment(\.appTheme) private var theme
    @State private var isAdding = false
    @State private var transport = TransportOption.stdio
    @State private var serverId = ""
    @State private var title = ""
    @State private var command = ""
    @State private var argsText = ""
    @State private var cwd = ""
    @State private var requestTimeoutMsText = ""
    @State private var autoAcceptEmptyForm = false
    @State private var url = ""
    @State private var headersText = ""

    var body: some View {
        SettingsPage {
            restartNotice

            if viewModel.servers.isEmpty {
                emptyState
            } else {
                SettingsListSection(items: viewModel.servers) { server in
                    serverRow(server)
                }
            }

            SettingsSectionSeparator()
            addButton

            if isAdding {
                SettingsSectionSeparator()
                createForm
            }

            if let error = viewModel.saveErrorMessage {
                errorFooter(error)
            }

            Spacer(minLength: 0)
        }
        .overlayScrollbar()
    }

    private var restartNotice: some View {
        SettingsSection {
            HStack(spacing: theme.spacing.sm) {
                Image(systemName: "arrow.triangle.2.circlepath")
                    .foregroundStyle(theme.colors.textSecondary)
                Text("MCP 配置会在 agent-server 启动时读取；保存后重启桌面 App 生效")
                    .font(theme.typography.captionFont)
                    .foregroundStyle(theme.colors.textSecondary)
                Spacer()
                SettingsActionButton(title: "刷新", systemImage: "arrow.clockwise", role: .secondary) {
                    viewModel.reload()
                }
            }
        }
    }

    private var emptyState: some View {
        SettingsEmptyState(title: "暂无 MCP Server", systemImage: "server.rack", reload: nil)
    }

    private func serverRow(_ server: MCPServerEntry) -> some View {
        SettingsRow(server.title) {
            VStack(alignment: .leading, spacing: theme.spacing.sm) {
                HStack(alignment: .firstTextBaseline, spacing: theme.spacing.sm) {
                    Text(server.detail)
                        .font(theme.typography.captionFont)
                        .foregroundStyle(theme.colors.textPrimary)
                        .lineLimit(2)
                        .truncationMode(.middle)
                    Spacer()
                    SettingsActionButton(title: "删除", systemImage: "trash", role: .destructive) {
                        viewModel.removeServer(id: server.id)
                    }
                }
                HStack(spacing: theme.spacing.sm) {
                    Text(server.id)
                        .font(theme.typography.captionFont.monospaced())
                    Text(server.transportLabel)
                    Spacer()
                }
                .foregroundStyle(theme.colors.textSecondary)
            }
        }
    }

    private var addButton: some View {
        SettingsSection {
            HStack {
                SettingsActionButton(
                    title: isAdding ? "收起" : "新增 MCP Server",
                    systemImage: isAdding ? "chevron.up" : "plus",
                    role: .primary,
                    action: { isAdding.toggle() }
                )

                Spacer()

                SettingsActionButton(
                    title: "添加示例",
                    systemImage: "sparkles",
                    role: .secondary,
                    action: { viewModel.installExampleServers() }
                )
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var createForm: some View {
        VStack(spacing: 0) {
            SettingsSectionHeader("新增 MCP Server")
            SettingsSection {
                SettingsRow("Transport") {
                    SettingsSegmentedControl(
                        TransportOption.allCases,
                        selection: $transport,
                        title: \.title
                    )
                    .frame(maxWidth: 340)
                }
                SettingsRowDivider()
                SettingsRow("Server ID") {
                    SettingsTextField(placeholder: "filesystem", text: $serverId)
                }
                SettingsRowDivider()
                SettingsRow("标题") {
                    SettingsTextField(placeholder: "Filesystem", text: $title)
                }

                if transport == .stdio {
                    stdioFields
                } else {
                    httpFields
                }

                SettingsRowDivider()
                formButtons
            }
        }
    }

    @ViewBuilder
    private var stdioFields: some View {
        SettingsRowDivider()
        SettingsRow("Command") {
            SettingsTextField(placeholder: "npx", text: $command)
        }
        SettingsRowDivider()
        SettingsRow("Args") {
            SettingsTextField(placeholder: "--yes @modelcontextprotocol/server-filesystem /tmp", text: $argsText)
        }
        SettingsRowDivider()
        SettingsRow("CWD") {
            SettingsTextField(placeholder: "/path/to/server", text: $cwd)
        }
        SettingsRowDivider()
        SettingsRow("Timeout") {
            SettingsTextField(placeholder: "60000", text: $requestTimeoutMsText)
        }
        SettingsRowDivider()
        SettingsRow("Elicitation") {
            Toggle("autoAcceptEmptyForm", isOn: $autoAcceptEmptyForm)
                .toggleStyle(.switch)
        }
    }

    @ViewBuilder
    private var httpFields: some View {
        SettingsRowDivider()
        SettingsRow("URL") {
            SettingsTextField(placeholder: "https://example.com/mcp", text: $url)
        }
        SettingsRowDivider()
        SettingsRow("Headers") {
            SettingsTextEditor(text: $headersText, placeholder: "Authorization=Bearer ${TOKEN}")
        }
    }

    private var formButtons: some View {
        SettingsFormActions {
            SettingsActionButton(
                title: "取消",
                systemImage: "xmark",
                role: .secondary,
                action: resetForm
            )
        } trailing: {
            SettingsActionButton(
                title: "保存",
                systemImage: "checkmark",
                role: .primary,
                action: {
                    if saveServer() {
                        resetForm()
                    }
                }
            )
            .disabled(serverId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .font(theme.typography.bodyFont)
    }

    private func saveServer() -> Bool {
        switch transport {
        case .stdio:
            return viewModel.createStdioServer(
                id: serverId,
                title: title,
                command: command,
                argsText: argsText,
                cwd: cwd,
                requestTimeoutMsText: requestTimeoutMsText,
                autoAcceptEmptyForm: autoAcceptEmptyForm
            )
        case .streamableHTTP:
            return viewModel.createHTTPServer(
                id: serverId,
                title: title,
                url: url,
                headersText: headersText
            )
        }
    }

    private func resetForm() {
        isAdding = false
        transport = .stdio
        serverId = ""
        title = ""
        command = ""
        argsText = ""
        cwd = ""
        requestTimeoutMsText = ""
        autoAcceptEmptyForm = false
        url = ""
        headersText = ""
    }

    private func errorFooter(_ error: String) -> some View {
        SettingsErrorFooter(message: error)
    }
}
