package notification

import (
	"bufio"
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"
	"strings"
	"time"
)

type SMTPConfig struct {
	Host     string
	Port     string
	Username string
	Password string
	From     string
}

type SMTPSender struct {
	config SMTPConfig
}

func NewSMTPSender(config SMTPConfig) *SMTPSender {
	return &SMTPSender{config: config}
}

func (sender *SMTPSender) Send(ctx context.Context, recipient, subject, body string) error {
	if strings.ContainsAny(recipient+subject+sender.config.From, "\r\n") {
		return fmt.Errorf("email header contains a newline")
	}
	address := net.JoinHostPort(sender.config.Host, sender.config.Port)
	connection, err := (&net.Dialer{Timeout: 10 * time.Second}).DialContext(ctx, "tcp", address)
	if err != nil {
		return fmt.Errorf("connect SMTP: %w", err)
	}
	defer connection.Close()
	if deadline, ok := ctx.Deadline(); ok {
		_ = connection.SetDeadline(deadline)
	}

	client, err := smtp.NewClient(connection, sender.config.Host)
	if err != nil {
		return fmt.Errorf("create SMTP client: %w", err)
	}
	defer client.Close()
	if ok, _ := client.Extension("STARTTLS"); !ok {
		return fmt.Errorf("SMTP server does not support STARTTLS")
	}
	if err := client.StartTLS(&tls.Config{ServerName: sender.config.Host, MinVersion: tls.VersionTLS12}); err != nil {
		return fmt.Errorf("start SMTP TLS: %w", err)
	}
	if sender.config.Username != "" {
		auth := smtp.PlainAuth("", sender.config.Username, sender.config.Password, sender.config.Host)
		if err := client.Auth(auth); err != nil {
			return fmt.Errorf("authenticate SMTP: %w", err)
		}
	}
	if err := client.Mail(sender.config.From); err != nil {
		return fmt.Errorf("set SMTP sender: %w", err)
	}
	if err := client.Rcpt(recipient); err != nil {
		return fmt.Errorf("set SMTP recipient: %w", err)
	}
	writer, err := client.Data()
	if err != nil {
		return fmt.Errorf("open SMTP body: %w", err)
	}
	message := "From: " + sender.config.From + "\r\n" +
		"To: " + recipient + "\r\n" +
		"Subject: " + subject + "\r\n" +
		"MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n" + body
	buffer := bufio.NewWriter(writer)
	if _, err := buffer.WriteString(message); err != nil {
		_ = writer.Close()
		return fmt.Errorf("write SMTP body: %w", err)
	}
	if err := buffer.Flush(); err != nil {
		_ = writer.Close()
		return fmt.Errorf("flush SMTP body: %w", err)
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("close SMTP body: %w", err)
	}
	if err := client.Quit(); err != nil {
		return fmt.Errorf("finish SMTP transaction: %w", err)
	}
	return nil
}
