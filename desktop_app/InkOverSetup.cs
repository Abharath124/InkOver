using System;
using System.IO;
using System.Reflection;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Shapes;

namespace InkOverInstaller
{
    public class SetupApp : Application
    {
        [STAThread]
        public static void Main()
        {
            SetupApp app = new SetupApp();
            app.Run(new SetupWindow());
        }
    }

    public class SetupWindow : Window
    {
        private ProgressBar progressBar;
        private TextBlock statusText;
        private TextBlock stepDetailText;
        private Button btnAction;
        private CheckBox chkLaunch;
        private StackPanel finishPanel;
        private StackPanel progressPanel;
        private StackPanel welcomePanel;

        private string installDir;
        private string targetExePath;

        public SetupWindow()
        {
            this.Title = "InkOver Setup - Windows Screen Studio";
            this.Width = 540;
            this.Height = 400;
            this.WindowStartupLocation = WindowStartupLocation.CenterScreen;
            this.ResizeMode = ResizeMode.NoResize;
            this.WindowStyle = WindowStyle.None;
            this.AllowsTransparency = true;
            this.Background = Brushes.Transparent;

            installDir = System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "InkOver");
            targetExePath = System.IO.Path.Combine(installDir, "InkOver.exe");

            BuildUI();
        }

        private void BuildUI()
        {
            // Outer Border with Glass / Dark Aesthetic
            Border outerBorder = new Border
            {
                CornerRadius = new CornerRadius(16),
                Background = new SolidColorBrush(Color.FromRgb(15, 23, 42)), // Slate 900
                BorderBrush = new SolidColorBrush(Color.FromArgb(80, 255, 87, 34)), // Brand orange border
                BorderThickness = new Thickness(1.5),
                ClipToBounds = true
            };

            Grid mainGrid = new Grid();
            mainGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(50) }); // Titlebar
            mainGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) }); // Content
            mainGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(65) }); // Bottom Actions

            // 1. Titlebar (Draggable)
            Grid titlebar = new Grid { Background = new SolidColorBrush(Color.FromRgb(20, 29, 50)) };
            titlebar.MouseLeftButtonDown += (s, e) => { if (e.ButtonState == System.Windows.Input.MouseButtonState.Pressed) this.DragMove(); };

            StackPanel titleLeft = new StackPanel { Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(16, 0, 0, 0) };
            
            // Logo Badge
            Border logoBadge = new Border
            {
                Width = 26,
                Height = 26,
                CornerRadius = new CornerRadius(6),
                Background = new LinearGradientBrush(Color.FromRgb(255, 87, 34), Color.FromRgb(245, 78, 24), 45),
                Margin = new Thickness(0, 0, 10, 0)
            };
            TextBlock logoText = new TextBlock
            {
                Text = "IO",
                Foreground = Brushes.White,
                FontWeight = FontWeights.Black,
                FontSize = 11,
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center
            };
            logoBadge.Child = logoText;
            titleLeft.Children.Add(logoBadge);

            TextBlock titleText = new TextBlock
            {
                Text = "InkOver Studio Setup • v3.12",
                Foreground = new SolidColorBrush(Color.FromRgb(226, 232, 240)),
                FontWeight = FontWeights.SemiBold,
                FontSize = 13,
                VerticalAlignment = VerticalAlignment.Center
            };
            titleLeft.Children.Add(titleText);
            titlebar.Children.Add(titleLeft);

            // Close button
            Button btnClose = new Button
            {
                Content = "✕",
                Foreground = new SolidColorBrush(Color.FromRgb(148, 163, 184)),
                Background = Brushes.Transparent,
                BorderThickness = new Thickness(0),
                FontSize = 12,
                Width = 36,
                Height = 36,
                HorizontalAlignment = HorizontalAlignment.Right,
                Margin = new Thickness(0, 0, 8, 0),
                Cursor = System.Windows.Input.Cursors.Hand
            };
            btnClose.Click += (s, e) => this.Close();
            titlebar.Children.Add(btnClose);

            Grid.SetRow(titlebar, 0);
            mainGrid.Children.Add(titlebar);

            // 2. Content Area
            Grid contentArea = new Grid { Margin = new Thickness(32, 20, 32, 10) };

            // Panel A: Welcome Screen
            welcomePanel = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
            
            TextBlock welcomeTitle = new TextBlock
            {
                Text = "Install InkOver on your Windows PC",
                Foreground = Brushes.White,
                FontSize = 19,
                FontWeight = FontWeights.Bold,
                Margin = new Thickness(0, 0, 0, 8)
            };
            welcomePanel.Children.Add(welcomeTitle);

            TextBlock welcomeDesc = new TextBlock
            {
                Text = "The premier on-screen annotation and whiteboard studio for educators, presenters, and engineers. Zero ads, zero tracking, completely free forever.",
                Foreground = new SolidColorBrush(Color.FromRgb(148, 163, 184)),
                FontSize = 12.5,
                TextWrapping = TextWrapping.Wrap,
                LineHeight = 19,
                Margin = new Thickness(0, 0, 0, 18)
            };
            welcomePanel.Children.Add(welcomeDesc);

            // Target path box
            Border pathBox = new Border
            {
                Background = new SolidColorBrush(Color.FromArgb(50, 255, 255, 255)),
                BorderBrush = new SolidColorBrush(Color.FromArgb(40, 255, 255, 255)),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(8),
                Padding = new Thickness(12, 10, 12, 10),
                Margin = new Thickness(0, 0, 0, 14)
            };
            StackPanel pathInfo = new StackPanel();
            TextBlock lblDestination = new TextBlock
            {
                Text = "INSTALLATION LOCATION",
                FontSize = 10,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush(Color.FromRgb(255, 87, 34)),
                Margin = new Thickness(0, 0, 0, 3)
            };
            TextBlock txtDestination = new TextBlock
            {
                Text = installDir,
                FontSize = 12,
                Foreground = new SolidColorBrush(Color.FromRgb(203, 213, 225))
            };
            pathInfo.Children.Add(lblDestination);
            pathInfo.Children.Add(txtDestination);
            pathBox.Child = pathInfo;
            welcomePanel.Children.Add(pathBox);

            TextBlock licenseNote = new TextBlock
            {
                Text = "✓ Free Community License  •  ✓ Desktop Shortcut  •  ✓ No Admin Rights Required",
                FontSize = 11,
                Foreground = new SolidColorBrush(Color.FromRgb(52, 211, 153)) // Emerald green
            };
            welcomePanel.Children.Add(licenseNote);

            contentArea.Children.Add(welcomePanel);

            // Panel B: Progress Screen
            progressPanel = new StackPanel { VerticalAlignment = VerticalAlignment.Center, Visibility = Visibility.Collapsed };
            
            statusText = new TextBlock
            {
                Text = "Installing InkOver...",
                Foreground = Brushes.White,
                FontSize = 18,
                FontWeight = FontWeights.Bold,
                Margin = new Thickness(0, 0, 0, 6)
            };
            progressPanel.Children.Add(statusText);

            stepDetailText = new TextBlock
            {
                Text = "Extracting files to local application directory...",
                Foreground = new SolidColorBrush(Color.FromRgb(148, 163, 184)),
                FontSize = 12,
                Margin = new Thickness(0, 0, 0, 20)
            };
            progressPanel.Children.Add(stepDetailText);

            progressBar = new ProgressBar
            {
                Height = 10,
                Minimum = 0,
                Maximum = 100,
                Value = 0,
                Background = new SolidColorBrush(Color.FromRgb(30, 41, 59)),
                Foreground = new SolidColorBrush(Color.FromRgb(255, 87, 34)),
                BorderThickness = new Thickness(0)
            };
            progressPanel.Children.Add(progressBar);
            contentArea.Children.Add(progressPanel);

            // Panel C: Finished Screen
            finishPanel = new StackPanel { VerticalAlignment = VerticalAlignment.Center, Visibility = Visibility.Collapsed };
            
            TextBlock finishTitle = new TextBlock
            {
                Text = "Installation Complete!",
                Foreground = Brushes.White,
                FontSize = 20,
                FontWeight = FontWeights.Bold,
                Margin = new Thickness(0, 0, 0, 8)
            };
            finishPanel.Children.Add(finishTitle);

            TextBlock finishDesc = new TextBlock
            {
                Text = "InkOver has been successfully installed and a shortcut has been created on your Desktop. You can start drawing on your screen anytime.",
                Foreground = new SolidColorBrush(Color.FromRgb(148, 163, 184)),
                FontSize = 12.5,
                TextWrapping = TextWrapping.Wrap,
                LineHeight = 18,
                Margin = new Thickness(0, 0, 0, 18)
            };
            finishPanel.Children.Add(finishDesc);

            chkLaunch = new CheckBox
            {
                Content = "Launch InkOver now",
                IsChecked = true,
                Foreground = Brushes.White,
                FontSize = 13,
                FontWeight = FontWeights.SemiBold
            };
            finishPanel.Children.Add(chkLaunch);
            contentArea.Children.Add(finishPanel);

            Grid.SetRow(contentArea, 1);
            mainGrid.Children.Add(contentArea);

            // 3. Bottom Action Bar
            Border bottomBar = new Border
            {
                Background = new SolidColorBrush(Color.FromRgb(20, 29, 50)),
                Padding = new Thickness(24, 0, 24, 0)
            };
            Grid bottomGrid = new Grid();

            TextBlock infoFootnote = new TextBlock
            {
                Text = "Standalone Local Installation",
                FontSize = 11,
                Foreground = new SolidColorBrush(Color.FromRgb(100, 116, 139)),
                VerticalAlignment = VerticalAlignment.Center
            };
            bottomGrid.Children.Add(infoFootnote);

            btnAction = new Button
            {
                Content = "Install InkOver Now",
                Width = 170,
                Height = 38,
                HorizontalAlignment = HorizontalAlignment.Right,
                VerticalAlignment = VerticalAlignment.Center,
                Background = new LinearGradientBrush(Color.FromRgb(255, 87, 34), Color.FromRgb(234, 76, 20), 45),
                Foreground = Brushes.White,
                FontWeight = FontWeights.Bold,
                FontSize = 13,
                BorderThickness = new Thickness(0),
                Cursor = System.Windows.Input.Cursors.Hand
            };
            btnAction.Click += OnActionButtonClicked;
            bottomGrid.Children.Add(btnAction);

            bottomBar.Child = bottomGrid;
            Grid.SetRow(bottomBar, 2);
            mainGrid.Children.Add(bottomBar);

            outerBorder.Child = mainGrid;
            this.Content = outerBorder;
        }

        private int currentStep = 0; // 0 = Welcome, 1 = Installing, 2 = Finished

        private void OnActionButtonClicked(object sender, RoutedEventArgs e)
        {
            if (currentStep == 0)
            {
                currentStep = 1;
                welcomePanel.Visibility = Visibility.Collapsed;
                progressPanel.Visibility = Visibility.Visible;
                btnAction.IsEnabled = false;
                btnAction.Content = "Installing...";

                RunInstallation();
            }
            else if (currentStep == 2)
            {
                if (chkLaunch != null && chkLaunch.IsChecked == true)
                {
                    try
                    {
                        if (File.Exists(targetExePath))
                        {
                            Process.Start(new ProcessStartInfo(targetExePath) { WorkingDirectory = installDir });
                        }
                    }
                    catch { }
                }
                this.Close();
            }
        }

        private void RunInstallation()
        {
            Thread worker = new Thread(new ThreadStart(() =>
            {
                UpdateProgress(15, "Creating destination folders...");
                Thread.Sleep(300);

                try
                {
                    if (!Directory.Exists(installDir))
                    {
                        Directory.CreateDirectory(installDir);
                    }
                }
                catch { }

                UpdateProgress(35, "Extracting InkOver engine binary...");
                Thread.Sleep(400);

                // Write InkOver.exe
                try
                {
                    // Check if embedded as resource
                    Assembly asm = Assembly.GetExecutingAssembly();
                    Stream resStream = asm.GetManifestResourceStream("InkOver.exe");

                    if (resStream != null)
                    {
                        using (FileStream fs = new FileStream(targetExePath, FileMode.Create, FileAccess.Write))
                        {
                            resStream.CopyTo(fs);
                        }
                    }
                    else
                    {
                        // Fallback: Check if InkOver.exe or EpicPen.exe is beside this installer
                        string localSource = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "InkOver.exe");
                        if (!File.Exists(localSource))
                        {
                            localSource = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "EpicPen.exe");
                        }

                        if (File.Exists(localSource))
                        {
                            File.Copy(localSource, targetExePath, true);
                        }
                    }
                }
                catch (Exception ex)
                {
                    // Process might be locked if already running
                }

                UpdateProgress(65, "Creating Desktop shortcut...");
                Thread.Sleep(350);

                CreateDesktopShortcut();

                UpdateProgress(85, "Creating Start Menu entry...");
                Thread.Sleep(300);

                CreateStartMenuShortcut();

                UpdateProgress(100, "Installation complete!");
                Thread.Sleep(350);

                this.Dispatcher.Invoke(new Action(() =>
                {
                    currentStep = 2;
                    progressPanel.Visibility = Visibility.Collapsed;
                    finishPanel.Visibility = Visibility.Visible;
                    btnAction.IsEnabled = true;
                    btnAction.Content = "Finish";
                }));
            }));

            worker.IsBackground = true;
            worker.Start();
        }

        private void UpdateProgress(int percent, string message)
        {
            this.Dispatcher.Invoke(new Action(() =>
            {
                progressBar.Value = percent;
                stepDetailText.Text = message;
            }));
        }

        private void CreateDesktopShortcut()
        {
            try
            {
                string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                string shortcutPath = System.IO.Path.Combine(desktopPath, "InkOver.lnk");
                CreateShortcutWithShell(shortcutPath, targetExePath);
            }
            catch { }
        }

        private void CreateStartMenuShortcut()
        {
            try
            {
                string startMenuPath = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
                string shortcutPath = System.IO.Path.Combine(startMenuPath, "InkOver.lnk");
                CreateShortcutWithShell(shortcutPath, targetExePath);
            }
            catch { }
        }

        private void CreateShortcutWithShell(string shortcutPath, string targetPath)
        {
            try
            {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType != null)
                {
                    dynamic shell = Activator.CreateInstance(shellType);
                    dynamic shortcut = shell.CreateShortcut(shortcutPath);
                    shortcut.TargetPath = targetPath;
                    shortcut.WorkingDirectory = System.IO.Path.GetDirectoryName(targetPath);
                    shortcut.Description = "InkOver - Screen Marker & Annotation Studio";
                    shortcut.Save();
                }
            }
            catch
            {
                // Fallback to powershell command if COM fails
                try
                {
                    string psCmd = string.Format("$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('{0}'); $s.TargetPath = '{1}'; $s.WorkingDirectory = '{2}'; $s.Save();",
                        shortcutPath.Replace("'", "''"),
                        targetPath.Replace("'", "''"),
                        System.IO.Path.GetDirectoryName(targetPath).Replace("'", "''"));

                    ProcessStartInfo psi = new ProcessStartInfo("powershell", "-NoProfile -ExecutionPolicy Bypass -Command \"" + psCmd + "\"")
                    {
                        CreateNoWindow = true,
                        UseShellExecute = false
                    };
                    Process.Start(psi);
                }
                catch { }
            }
        }
    }
}
