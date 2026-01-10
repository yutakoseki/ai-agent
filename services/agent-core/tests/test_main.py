import main


def test_main_prints_ready_message(capsys):
    main.main()
    captured = capsys.readouterr()
    assert "AgentCore placeholder: ready to receive jobs." in captured.out


